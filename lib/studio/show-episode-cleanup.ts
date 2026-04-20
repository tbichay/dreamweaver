/**
 * ShowEpisode stale-recovery sweeper.
 *
 * The generation pipeline currently runs as a fire-and-forget Promise off
 * the POST /api/canzoia/shows/[slug]/generate handler (see route.ts:147).
 * If the host process dies mid-generation — Vercel function timeout, dev
 * server restart, OOM, uncaught rejection — the Promise is lost and the
 * DB row stays in a non-terminal status forever (queued|scripting|
 * synthesizing|uploading), no errorMessage, no completedAt.
 *
 * This sweeper finds those ghost rows and marks them `failed` so:
 *   1) Idempotency replay (same key) returns `failed` instead of forever
 *      `synthesizing 45%`, which lets the user retry with a fresh job.
 *   2) Canzoia's poll UI shows an actual error rather than a silent stall.
 *   3) `generation.failed` webhook still fires so Canzoia learns about it.
 *
 * Called from:
 *   - POST /api/canzoia/shows/[slug]/generate (every new request sweeps first)
 *   - GET  /api/cron/process-studio-tasks     (every-minute backstop)
 *
 * Once the show-episode pipeline moves onto the StudioTask queue this file
 * can be retired — StudioTask has its own stale-task recovery at
 * process-studio-tasks/route.ts:62.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { deliverWebhookSafe } from "@/lib/canzoia/webhooks";

// 15 minutes: longer than any realistic successful generation (the 15-min
// "Lang" story needs ~3-5 min end-to-end), short enough that a stalled job
// surfaces as failed within a few minutes of the user noticing.
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

const NON_TERMINAL_STATUSES = ["queued", "scripting", "synthesizing", "uploading"] as const;

interface RecoveryResult {
  swept: number;
  ids: string[];
}

export async function recoverStuckShowEpisodes(): Promise<RecoveryResult> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Fetch first so we can emit webhooks after the bulk update.
  const stuck = await prisma.showEpisode.findMany({
    where: {
      status: { in: NON_TERMINAL_STATUSES as unknown as string[] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      canzoiaJobId: true,
      idempotencyKey: true,
      showFokusId: true,
      canzoiaProfileId: true,
      status: true,
      progressPct: true,
      progressStage: true,
      show: { select: { slug: true } },
    },
  });

  if (stuck.length === 0) {
    return { swept: 0, ids: [] };
  }

  const now = new Date();
  await prisma.showEpisode.updateMany({
    where: { id: { in: stuck.map((e) => e.id) } },
    data: {
      status: "failed",
      errorCode: "ProcessDied",
      errorMessage:
        "Generation process died before completion (likely serverless function timeout or process crash). Auto-recovered by sweeper. Please retry with a fresh idempotencyKey.",
      completedAt: now,
    },
  });

  // Best-effort webhook so Canzoia's polling UI can transition to the
  // failed state immediately instead of waiting for its own timeout.
  for (const row of stuck) {
    deliverWebhookSafe({
      event: "generation.failed",
      deliveryId: randomUUID(),
      timestamp: now.toISOString(),
      jobId: row.canzoiaJobId,
      idempotencyKey: row.idempotencyKey,
      showSlug: row.show.slug,
      showFokusId: row.showFokusId,
      canzoiaProfileId: row.canzoiaProfileId,
      error: {
        code: "ProcessDied",
        message: `Stuck in status=${row.status} at ${row.progressPct}% (stage: ${row.progressStage ?? "—"}) for longer than ${Math.round(STALE_THRESHOLD_MS / 60000)} minutes`,
      },
    });
  }

  console.warn(
    `[show-episode-cleanup] Swept ${stuck.length} stale episode(s): ${stuck.map((e) => e.id).join(", ")}`,
  );

  return { swept: stuck.length, ids: stuck.map((e) => e.id) };
}
