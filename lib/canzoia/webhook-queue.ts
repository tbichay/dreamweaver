/**
 * Persistent outbound-webhook queue.
 *
 * Replaces the old in-memory fire-and-forget delivery with a DB-backed
 * queue + exponential backoff. See the `WebhookDelivery` model in
 * schema.prisma for the why and the retry schedule.
 *
 * Call-site contract (unchanged): `deliverWebhookSafe(event)` still
 * returns `void` and never throws. Under the hood it now INSERTs a row
 * and returns — actual delivery happens from `processPendingDeliveries()`
 * on the cron tick.
 *
 * Progress events bypass the queue (stale within seconds, no point
 * retrying). Completed + failed go through the queue.
 */

import { prisma } from "@/lib/db";
import { signOutgoingWebhook } from "./signing";
import type { CanzoiaWebhookEvent } from "./webhooks";

/**
 * Delay (seconds) before the Nth retry. Index 0 = first retry after the
 * initial attempt failed. After index 5 (24h) the row is marked `dead`.
 *
 * Schedule matches docs/CANZOIA_API.md §5.3: 30s, 2m, 10m, 1h, 6h, 24h.
 */
const RETRY_DELAYS_SEC = [30, 120, 600, 3600, 21600, 86400] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_SEC.length + 1; // 7

/** Truncate error messages so we don't balloon the DB row on noisy failures. */
const MAX_ERROR_LEN = 500;

/** How many pending rows the worker processes per tick. Keep modest so
 * one slow delivery can't starve the others — 20 is comfortable at a
 * 60s cron schedule. */
const BATCH_SIZE = 20;

/** Per-request timeout. Canzoia should ack in <1s, but we give it room. */
const DELIVERY_TIMEOUT_MS = 10_000;

export interface WebhookQueueSummary {
  scanned: number;
  delivered: number;
  retrying: number;
  dead: number;
  errors: Array<{ deliveryId: string; message: string }>;
}

/**
 * Enqueue an outbound event for delivery. Idempotent on `deliveryId` —
 * if we've already queued this event (same UUID), this is a no-op.
 *
 * Never throws: a DB error here must not take down the generator.
 */
export async function enqueueWebhook(event: CanzoiaWebhookEvent): Promise<void> {
  const url = process.env.CANZOIA_WEBHOOK_URL;
  if (!url) {
    // No webhook configured (local dev, or Canzoia not wired yet) —
    // legitimate state. Drop silently, as before.
    return;
  }

  // Progress events never go through the queue: by the time a retry
  // fires, the progress number is wrong anyway. Deliver best-effort
  // synchronously.
  if (event.event === "generation.progress") {
    await deliverOnce({
      url,
      body: JSON.stringify(event),
      deliveryId: event.deliveryId,
      event: event.event,
    }).catch(() => {
      // Swallow — progress is best-effort.
    });
    return;
  }

  try {
    await prisma.webhookDelivery.create({
      data: {
        deliveryId: event.deliveryId,
        event: event.event,
        jobId: "jobId" in event ? event.jobId : null,
        url,
        payload: event as object,
      },
    });
  } catch (e) {
    // P2002 (unique constraint on deliveryId) = already queued. No-op.
    const code = (e as { code?: string }).code;
    if (code === "P2002") return;
    console.error("[webhook-queue] enqueue failed:", e);
  }
}

/**
 * Drain one batch of pending deliveries. Called by the cron.
 *
 * Error policy:
 *   - 2xx response → delivered.
 *   - Any other response / fetch error → bump attempts, schedule next,
 *     or mark dead if we've exhausted retries.
 *   - Database error while updating status → bubble up so the caller
 *     can log + keep the row `pending` for the next tick (safer than
 *     silently losing track).
 */
export async function processPendingDeliveries(): Promise<WebhookQueueSummary> {
  const summary: WebhookQueueSummary = {
    scanned: 0,
    delivered: 0,
    retrying: 0,
    dead: 0,
    errors: [],
  };

  const rows = await prisma.webhookDelivery.findMany({
    where: {
      status: "pending",
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH_SIZE,
  });

  summary.scanned = rows.length;

  for (const row of rows) {
    const body =
      typeof row.payload === "string"
        ? row.payload
        : JSON.stringify(row.payload);

    const attempt = await deliverOnce({
      url: row.url,
      body,
      deliveryId: row.deliveryId,
      event: row.event,
    });

    const nextAttempts = row.attempts + 1;

    if (attempt.ok) {
      await prisma.webhookDelivery.update({
        where: { id: row.id },
        data: {
          status: "delivered",
          attempts: nextAttempts,
          deliveredAt: new Date(),
          lastStatus: attempt.status ?? null,
          lastError: null,
        },
      });
      summary.delivered++;
      continue;
    }

    const errorMessage = (attempt.error ?? `HTTP ${attempt.status ?? "?"}`).slice(
      0,
      MAX_ERROR_LEN,
    );
    summary.errors.push({ deliveryId: row.deliveryId, message: errorMessage });

    if (nextAttempts >= MAX_ATTEMPTS) {
      await prisma.webhookDelivery.update({
        where: { id: row.id },
        data: {
          status: "dead",
          attempts: nextAttempts,
          lastError: errorMessage,
          lastStatus: attempt.status ?? null,
        },
      });
      summary.dead++;
      console.warn(
        `[webhook-queue] delivery ${row.deliveryId} DEAD after ${nextAttempts} attempts: ${errorMessage}`,
      );
      continue;
    }

    // Index into RETRY_DELAYS_SEC: attempt 1 just failed → delay[0] = 30s.
    const delaySec = RETRY_DELAYS_SEC[nextAttempts - 1] ?? RETRY_DELAYS_SEC[RETRY_DELAYS_SEC.length - 1];
    const nextAttemptAt = new Date(Date.now() + delaySec * 1000);
    await prisma.webhookDelivery.update({
      where: { id: row.id },
      data: {
        attempts: nextAttempts,
        nextAttemptAt,
        lastError: errorMessage,
        lastStatus: attempt.status ?? null,
      },
    });
    summary.retrying++;
  }

  return summary;
}

/**
 * Single HTTP attempt, freshly signed. Used both by the queue worker and
 * by the progress-event bypass in `enqueueWebhook`.
 */
async function deliverOnce(params: {
  url: string;
  body: string;
  deliveryId: string;
  event: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  let path: string;
  try {
    path = new URL(params.url).pathname;
  } catch {
    return { ok: false, error: `Invalid URL: ${params.url}` };
  }

  const signed = signOutgoingWebhook({
    method: "POST",
    path,
    rawBody: params.body,
  });
  if (!signed) {
    return { ok: false, error: "KOALATREE_TO_CANZOIA_SECRET missing" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(params.url, {
      method: "POST",
      headers: signed.headers,
      body: params.body,
      signal: ctrl.signal,
    });
    if (res.ok) {
      console.log(
        `[webhook-queue] ${params.event} → ${params.url}: ok status=${res.status} deliveryId=${params.deliveryId}`,
      );
      return { ok: true, status: res.status };
    }
    // Read + truncate body for diagnostics (Canzoia returns JSON error envelopes).
    let bodySnippet = "";
    try {
      bodySnippet = (await res.text()).slice(0, 200);
    } catch {
      // ignore
    }
    return {
      ok: false,
      status: res.status,
      error: `HTTP ${res.status}${bodySnippet ? `: ${bodySnippet}` : ""}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Manually re-queue a dead delivery. Intended for the admin retry
 * endpoint — sets attempts back to 0 and schedules immediate retry.
 */
export async function requeueDeadDelivery(deliveryId: string): Promise<boolean> {
  const existing = await prisma.webhookDelivery.findUnique({
    where: { deliveryId },
  });
  if (!existing || existing.status !== "dead") return false;
  await prisma.webhookDelivery.update({
    where: { deliveryId },
    data: {
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      lastStatus: null,
    },
  });
  return true;
}
