/**
 * Studio Episode-Retry — admin-only re-trigger fuer eine fehlgeschlagene
 * oder stuck-gebliebene Episode.
 *
 * POST /api/studio/shows/[slug]/episodes/[id]/retry
 *   → resettet ShowEpisode-Felder (status, error, progress, output) auf
 *     Initial-State und erzeugt einen neuen StudioTask — sodass der
 *     process-studio-tasks-Cron sie beim naechsten Tick (bzw. via
 *     Self-Kick sofort) erneut verarbeitet.
 *
 * Warum dieser Endpoint ueberhaupt existiert:
 *   Canzoia-Kunden retryen natuerlich mit einer neuen idempotencyKey
 *   (neuer jobId, neue Episode-Row). Admin-Debugging will aber dieselbe
 *   Row nochmal laufen lassen — mit dem alten Prompt-Snapshot, um zu
 *   sehen ob ein transient Claude-Fehler weg ist. Dafuer braucht es
 *   keinen neuen idempotencyKey — wir recyclen die Row und erstellen
 *   nur einen frischen Task-Slot.
 *
 * Kosten-Hinweis: der Generator ruft Claude + ElevenLabs neu an → der
 * Admin zahlt die Generation doppelt. Das ist OK fuer Debug-Retries,
 * aber nicht fuer Production-Auto-Retries (darum setzt die normale
 * Canzoia-POST-Route `maxRetries=0`).
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Statuses wir erlauben Retry fuer. `completed` blocken wir absichtlich
// — wenn der Admin eine erfolgreiche Generation neu laufen lassen will,
// soll er eine echte neue Episode via Test-Episode-Endpoint triggern,
// um den Audit-Verlauf sauber zu halten.
const RETRIABLE_STATUSES = new Set([
  "failed",
  "queued", // stuck im Queue ohne Task (z.B. Task manuell geloescht)
  "scripting",
  "synthesizing",
  "uploading",
]);

export async function POST(_request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug, id } = await ctx.params;

  const episode = await prisma.showEpisode.findUnique({
    where: { id },
    include: { show: { select: { slug: true, ownerUserId: true } } },
  });

  if (!episode) {
    return Response.json({ error: "Episode nicht gefunden" }, { status: 404 });
  }
  if (episode.show.slug !== slug) {
    return Response.json(
      { error: "Episode gehoert nicht zu dieser Show" },
      { status: 400 },
    );
  }
  if (!RETRIABLE_STATUSES.has(episode.status)) {
    return Response.json(
      {
        error: `Episode-Status "${episode.status}" kann nicht retryt werden. Erlaubt: ${[...RETRIABLE_STATUSES].join(", ")}`,
      },
      { status: 409 },
    );
  }

  // Reset + enqueue in einer Transaktion: ohne TX koennten wir die Row
  // zuruecksetzen, aber der Task-Insert fehlschlagen → Episode haengt
  // dann in `queued` ohne Task, bis der stuck-cleanup sie nach 15min
  // wieder auf failed setzt. Mit TX ist der Rollback-Pfad sauber.
  const taskId = await prisma.$transaction(async (tx) => {
    await tx.showEpisode.update({
      where: { id: episode.id },
      data: {
        status: "queued",
        progressPct: 0,
        progressStage: null,
        // Output-Felder clearen, damit die UI waehrend Retry nicht die
        // alten Werte als aktuell zeigt. Prompts behalten wir — sie
        // werden vom Generator in Phase 2 ohnehin ueberschrieben, aber
        // falls der Retry VOR Phase 2 stirbt (z.B. loadEpisodeInput
        // wirft), ist der alte Prompt-Snapshot immer noch besser als
        // gar nichts.
        errorCode: null,
        errorMessage: null,
        text: null,
        audioUrl: null,
        durationSec: null,
        timeline: undefined,
        inputTokens: null,
        outputTokens: null,
        ttsChars: null,
        totalMinutesBilled: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    const task = await tx.studioTask.create({
      data: {
        type: "show-episode",
        userId: episode.show.ownerUserId,
        status: "pending",
        // Prio 15: ueber Canzoia-Calls (10), unter Studio-Admin (20) —
        // Admin-Retries sind meist manuell-interaktiv, wollen also zuegig
        // durchlaufen, aber nicht vor einem echten Kinder-Klick drin.
        priority: 15,
        input: { episodeId: episode.id, canzoiaJobId: episode.canzoiaJobId } as object,
        maxRetries: 0,
      },
    });

    return task.id;
  });

  // Cron-Kick: gleicher Pfad wie in /api/canzoia/shows/[slug]/generate —
  // Self-Fetch ausloesen, damit der Admin nicht 60s auf den Scheduled-Tick
  // wartet. Fehler im Kick sind nicht kritisch — Cron holt es eh ab.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret || process.env.NODE_ENV === "development") {
    fetch(`${baseUrl}/api/cron/process-studio-tasks`, {
      method: "GET",
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      signal: AbortSignal.timeout(5_000),
    }).catch((e) => {
      console.warn(
        `[episode-retry] cron kick failed (non-fatal): ${e instanceof Error ? e.message : e}`,
      );
    });
  }

  return Response.json({
    ok: true,
    episodeId: episode.id,
    taskId,
    status: "queued",
  });
}
