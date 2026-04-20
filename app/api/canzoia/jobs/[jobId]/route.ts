/**
 * Canzoia API — GET /api/canzoia/jobs/[jobId]
 *
 * Per docs/CANZOIA_API.md §4.4. Fallback polling path for generation status;
 * Canzoia prefers webhooks (not yet wired) for the happy path.
 *
 * Response: JobStatus — status, progress, result (when completed).
 *   - For `status: "completed"`: result.audioUrl is a signed Vercel Blob URL
 *     (~1h TTL) minted fresh per poll via `getDownloadUrl()`. Canzoia should
 *     download + re-upload to its own R2 and NOT hot-link — the URL expires.
 *     Per CLAUDE.md: private Blob URLs are not externally fetchable, so
 *     without this signed-URL conversion Canzoia would get 401.
 *   - cost.totalMinutesBilled is what Canzoia deducts from user budget.
 */

import { prisma } from "@/lib/db";
import { verifyCanzoiaRequest } from "@/lib/canzoia/signing";
import { canzoiaError } from "@/lib/canzoia/errors";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = verifyCanzoiaRequest(request, "");
  if (!auth.ok) return canzoiaError("UNAUTHORIZED", auth.message);

  const { jobId } = await ctx.params;

  const episode = await prisma.showEpisode.findUnique({
    where: { canzoiaJobId: jobId },
    include: { show: { select: { slug: true, revisionHash: true } } },
  });
  if (!episode) return canzoiaError("SHOW_NOT_FOUND", `Job '${jobId}' not found`);

  // Mint a signed download URL only when the audio is actually ready and
  // the caller is going to use it — no point paying the round-trip on a
  // still-generating poll. Lazy-imported so the @vercel/blob SDK isn't
  // initialised on every cold-start for errored/pending responses.
  let signedAudioUrl: string | null = null;
  if (episode.status === "completed" && episode.audioUrl) {
    try {
      const { getDownloadUrl } = await import("@vercel/blob");
      signedAudioUrl = await getDownloadUrl(episode.audioUrl);
    } catch (e) {
      console.error(`[canzoia-jobs] Failed to mint signed URL for ${episode.id}:`, e);
      // Fall back to raw URL — Canzoia will get a clearer 401 than a silent
      // missing-field, and we keep the response shape consistent.
      signedAudioUrl = episode.audioUrl;
    }
  }

  return Response.json({
    jobId: episode.canzoiaJobId,
    idempotencyKey: episode.idempotencyKey,
    status: episode.status,
    progressPct: episode.progressPct,
    progressStage: episode.progressStage,
    showSlug: episode.show.slug,
    showFokusId: episode.showFokusId,
    showRevisionHashAtStart: episode.showRevisionHash,
    currentShowRevisionHash: episode.show.revisionHash,
    createdAt: episode.createdAt,
    completedAt: episode.completedAt,
    // Included only once completed — Canzoia keys on status to know when safe
    // to read these fields. Kept flat-shape-compatible with the spec intent.
    result: episode.status === "completed" && signedAudioUrl
      ? {
          title: episode.title,
          audioUrl: signedAudioUrl,
          durationSec: episode.durationSec,
          timeline: episode.timeline,
        }
      : null,
    cost: {
      inputTokens: episode.inputTokens,
      outputTokens: episode.outputTokens,
      ttsChars: episode.ttsChars,
      totalMinutesBilled: episode.totalMinutesBilled,
    },
    error: episode.status === "failed"
      ? {
          code: episode.errorCode ?? "INTERNAL_ERROR",
          message: episode.errorMessage ?? "Unknown error",
        }
      : null,
  });
}
