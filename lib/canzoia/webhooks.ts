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
 *                           If unset, webhook delivery silently no-ops (useful
 *                           for local dev before Canzoia is running).
 *   KOALATREE_TO_CANZOIA_SECRET — HMAC secret; same on both sides.
 *
 * MVP delivery semantics: single-shot POST with 5s timeout. If it fails we
 * log and move on — Canzoia can always reconcile by polling GET /jobs/[id].
 * The full retry schedule (§5.3: +0s/+30s/+2m/+10m/+1h/+6h/+24h) requires a
 * persistent queue (Vercel Queues / cron) and is deferred.
 *
 * Progress events are fire-and-forget (no await at call sites) so a slow or
 * dead webhook receiver cannot slow down generation.
 */

import { signOutgoingWebhook } from "./signing";

const WEBHOOK_TIMEOUT_MS = 5_000;

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

async function postSigned(url: string, body: string, path: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const signed = signOutgoingWebhook({ method: "POST", path, rawBody: body });
  if (!signed) {
    return { ok: false, error: "KOALATREE_TO_CANZOIA_SECRET missing" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: signed.headers,
      body,
      signal: ctrl.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function deliverWebhook(event: CanzoiaWebhookEvent): Promise<void> {
  const url = process.env.CANZOIA_WEBHOOK_URL;
  if (!url) {
    // No webhook configured (local dev, or Canzoia not wired yet).
    // That's a legitimate state — silently skip.
    return;
  }

  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    console.warn("[webhook] CANZOIA_WEBHOOK_URL is not a valid URL:", url);
    return;
  }

  const body = JSON.stringify(event);
  const result = await postSigned(url, body, path);

  if (!result.ok) {
    // Log-and-move-on per MVP semantics. Canzoia can reconcile via polling.
    console.warn(
      `[webhook] ${event.event} → ${url}: failed`,
      result.status ? `status=${result.status}` : result.error,
      `deliveryId=${event.deliveryId}`
    );
    return;
  }

  console.log(
    `[webhook] ${event.event} → ${url}: ok`,
    `status=${result.status} deliveryId=${event.deliveryId}`
  );
}

/** Fire-and-forget wrapper — never throws. Safe to call without await. */
export function deliverWebhookSafe(event: CanzoiaWebhookEvent): void {
  void deliverWebhook(event).catch((e) => {
    console.error("[webhook] unexpected dispatch error:", e);
  });
}
