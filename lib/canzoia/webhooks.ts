/**
 * Koalatree → Canzoia webhook dispatcher.
 *
 * Per docs/CANZOIA_API.md §5. Fires outbound signed webhooks for events
 * Canzoia needs to react to:
 *   - generation.completed — after an episode's audio lands in Blob
 *   - generation.failed    — terminal error
 *   - generation.progress  — best-effort, may be dropped
 *
 * Configuration:
 *   CANZOIA_WEBHOOK_URL   — Canzoia's /api/hooks/koalatree endpoint.
 *                           If unset, webhook delivery silently no-ops
 *                           (useful for local dev before Canzoia is running).
 *   KOALATREE_TO_CANZOIA_SECRET — HMAC secret; same on both sides.
 *
 * Delivery model (rewritten 2026-04-21 after we lost a production event
 * to a Canzoia 500):
 *   - completed / failed → enqueued in `WebhookDelivery`, delivered by
 *     the `process-webhook-queue` cron with exponential backoff
 *     (30s/2m/10m/1h/6h/24h). Survives Canzoia outages, signature
 *     rotation, transient 5xx.
 *   - progress → still fire-and-forget (stale within seconds, retrying
 *     is useless; Canzoia can read live state via GET /jobs/[id]).
 *
 * Call sites use `deliverWebhookSafe(event)` unchanged — same void-never-
 * throws contract. The only visible behaviour change is that delivery
 * now happens eventually instead of synchronously.
 */

import { enqueueWebhook } from "./webhook-queue";

type WebhookCommon = {
  deliveryId: string; // uuid — Canzoia dedupes on (event, jobId, deliveryId)
  timestamp: string; // ISO
};

type GenerationCompletedEvent = WebhookCommon & {
  event: "generation.completed";
  jobId: string;
  idempotencyKey: string;
  showSlug: string;
  showFokusId: string;
  canzoiaProfileId: string;
  result: {
    title: string | null;
    audioUrl: string;
    durationSec: number | null;
    timeline: unknown;
  };
  cost: {
    inputTokens: number | null;
    outputTokens: number | null;
    ttsChars: number | null;
    totalMinutesBilled: number | null;
  };
};

type GenerationFailedEvent = WebhookCommon & {
  event: "generation.failed";
  jobId: string;
  idempotencyKey: string;
  showSlug: string;
  showFokusId: string;
  canzoiaProfileId: string;
  error: {
    code: string;
    message: string;
  };
};

type GenerationProgressEvent = WebhookCommon & {
  event: "generation.progress";
  jobId: string;
  stage: string | null;
  progressPct: number;
};

export type CanzoiaWebhookEvent =
  | GenerationCompletedEvent
  | GenerationFailedEvent
  | GenerationProgressEvent;

/**
 * Fire-and-forget wrapper — never throws. Enqueues the event (or fires
 * directly for progress). Safe to call without await.
 *
 * Kept as a function (not an async arrow) to preserve the old `void`
 * return-type contract — existing call sites do `deliverWebhookSafe(e)`
 * without `await`, so we don't want to leak a Promise that gets
 * unhandled-rejection-logged.
 */
export function deliverWebhookSafe(event: CanzoiaWebhookEvent): void {
  void enqueueWebhook(event).catch((e) => {
    console.error("[webhook] unexpected enqueue error:", e);
  });
}
