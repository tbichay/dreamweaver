/**
 * Canzoia API — POST /api/canzoia/shows/[slug]/generate
 *
 * Per docs/CANZOIA_API.md §4.3. Triggers an asynchronous episode generation.
 *
 * Body (GenerationRequest):
 *   {
 *     idempotencyKey: string,           // required — Canzoia-mint, 24h dedupe window
 *     showFokusId: string,              // required
 *     canzoiaProfileId: string,         // required — attribution + per-profile billing
 *     showRevisionHash?: string,        // optional — triggers STALE_REVISION if mismatched
 *     userInputs: Record<string, unknown>,
 *     profileSnapshot: Record<string, unknown>,
 *     webhookUrl?: string               // optional — per-request override (not used yet)
 *   }
 *
 * Responses:
 *   202 GenerationAccepted — new job enqueued (or replay of existing jobId)
 *   400 INVALID_INPUT
 *   404 SHOW_NOT_FOUND | SHOW_NOT_PUBLISHED
 *   409 STALE_REVISION | IDEMPOTENCY_CONFLICT
 *
 * Fire-and-forget: generateShowEpisode runs on the serverless function's
 * remaining wall-clock. Canzoia should either poll GET /jobs/:id or wait for
 * the `generation.completed` webhook (not yet implemented — §5).
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { verifyCanzoiaRequest } from "@/lib/canzoia/signing";
import { canzoiaError } from "@/lib/canzoia/errors";
import { generateShowEpisode } from "@/lib/studio/show-episode-generator";

interface Body {
  idempotencyKey?: string;
  showFokusId?: string;
  canzoiaProfileId?: string;
  showRevisionHash?: string;
  userInputs?: Record<string, unknown>;
  profileSnapshot?: Record<string, unknown>;
  webhookUrl?: string;
}

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const rawBody = await request.text();
  const auth = verifyCanzoiaRequest(request, rawBody);
  if (!auth.ok) return canzoiaError("UNAUTHORIZED", auth.message);

  const { slug } = await ctx.params;

  let body: Body;
  try {
    body = JSON.parse(rawBody || "{}") as Body;
  } catch {
    return canzoiaError("INVALID_INPUT", "Invalid JSON body");
  }

  // ── Validate required fields ───────────────────────────────
  const missing: string[] = [];
  if (!body.idempotencyKey) missing.push("idempotencyKey");
  if (!body.showFokusId) missing.push("showFokusId");
  if (!body.canzoiaProfileId) missing.push("canzoiaProfileId");
  if (missing.length) {
    return canzoiaError("INVALID_INPUT", `Missing required field(s): ${missing.join(", ")}`, {
      missing,
    });
  }

  // ── Resolve show first (so replay check knows the show's current rev) ──
  const show = await prisma.show.findUnique({
    where: { slug },
    include: { foki: { where: { id: body.showFokusId } } },
  });
  if (!show) return canzoiaError("SHOW_NOT_FOUND", `Show '${slug}' not found`);
  if (!show.publishedAt) return canzoiaError("SHOW_NOT_PUBLISHED", `Show '${slug}' is in draft state`);

  // ── Idempotency replay ─────────────────────────────────────
  const existing = await prisma.showEpisode.findUnique({
    where: { idempotencyKey: body.idempotencyKey! },
  });
  if (existing) {
    // Spec §4.3: same key with identical payload → original response; with
    // different payload → IDEMPOTENCY_CONFLICT. We can detect conflict by
    // comparing the core invariants.
    const existingUserInputs = JSON.stringify(existing.userInputs);
    const newUserInputs = JSON.stringify(body.userInputs ?? {});
    const payloadChanged =
      existing.showFokusId !== body.showFokusId ||
      existing.showId !== show.id ||
      existing.canzoiaProfileId !== body.canzoiaProfileId ||
      existingUserInputs !== newUserInputs;
    if (payloadChanged) {
      return canzoiaError(
        "IDEMPOTENCY_CONFLICT",
        "idempotencyKey already used with a different payload"
      );
    }
    return Response.json(
      {
        jobId: existing.canzoiaJobId,
        status: existing.status,
        idempotencyKey: existing.idempotencyKey,
        estimatedReadyAt: null,
        pollAfterSec: 30,
        replay: true,
      },
      { status: 202 }
    );
  }

  // ── Fokus + revision checks ────────────────────────────────
  const fokus = show.foki[0];
  if (!fokus) {
    return canzoiaError("INVALID_INPUT", "showFokusId does not belong to this show");
  }
  if (!fokus.enabled) {
    return canzoiaError("INVALID_INPUT", "Fokus is disabled");
  }
  if (body.showRevisionHash && body.showRevisionHash !== show.revisionHash) {
    return canzoiaError(
      "STALE_REVISION",
      `Show revision changed (client=${body.showRevisionHash}, server=${show.revisionHash})`,
      { currentRevisionHash: show.revisionHash }
    );
  }

  // ── Create + kick off ──────────────────────────────────────
  const canzoiaJobId = randomUUID();
  const episode = await prisma.showEpisode.create({
    data: {
      showId: show.id,
      showFokusId: fokus.id,
      idempotencyKey: body.idempotencyKey!,
      canzoiaJobId,
      canzoiaProfileId: body.canzoiaProfileId!,
      showRevisionHash: show.revisionHash,
      userInputs: (body.userInputs ?? {}) as object,
      profileSnapshot: (body.profileSnapshot ?? {}) as object,
      status: "queued",
      progressPct: 0,
      startedAt: new Date(),
    },
  });

  void generateShowEpisode({ episodeId: episode.id }).catch((e) => {
    console.error(`[canzoia-gen] ${episode.id} background failure:`, e);
  });

  // Rough ETA: 60s per ~1000 TTS chars + 30s Claude. Pretty handwavy.
  const estMinutes = fokus.targetDurationMin;
  const estSec = 30 + estMinutes * 10;

  return Response.json(
    {
      jobId: canzoiaJobId,
      status: "queued",
      idempotencyKey: body.idempotencyKey,
      estimatedReadyAt: new Date(Date.now() + estSec * 1000).toISOString(),
      pollAfterSec: 30,
      replay: false,
    },
    { status: 202 }
  );
}
