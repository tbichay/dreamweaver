/**
 * Vercel Cron — GET /api/cron/process-webhook-queue
 *
 * Drains the `WebhookDelivery` table: delivers any `pending` row whose
 * `nextAttemptAt` has passed, with exponential-backoff retry on failure
 * (see lib/canzoia/webhook-queue.ts for the schedule).
 *
 * Schedule: every minute (vercel.json). A 60s granularity is fine — the
 * tightest retry we care about is 30s (post-failure), and the worst-case
 * latency between "episode completes" and "user sees it in Canzoia" is
 * roughly one cron tick anyway.
 *
 * Auth: Vercel Cron invokes with `Authorization: Bearer ${CRON_SECRET}`.
 * Manual trigger is fine for ops debugging — same header, curl it.
 */

import { processPendingDeliveries } from "@/lib/canzoia/webhook-queue";

export const runtime = "nodejs";
// One tick shouldn't take this long (batch-size = 20, per-delivery timeout
// = 10s → worst case ~200s), but we give headroom in case Canzoia is slow
// *and* we're draining a large backlog after an outage.
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  // In development (no CRON_SECRET set) we allow unauthenticated calls so
  // local `curl` smoke-tests work without an env dance. In prod the
  // secret is required.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    const summary = await processPendingDeliveries();
    const elapsedMs = Date.now() - started;
    // Parseable single-line log — easy to grep in Vercel logs.
    console.log(
      "[cron/process-webhook-queue]",
      JSON.stringify({ elapsedMs, ...summary }),
    );
    return Response.json({ ok: true, elapsedMs, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/process-webhook-queue] fatal:", message);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
