/**
 * Studio Episode-Detail — admin-only single-episode inspector.
 *
 * GET /api/studio/shows/[slug]/episodes/[id]
 *   → returns the full ShowEpisode inkl. rendered prompts, text, timeline,
 *     audio, cost + error fields. Used by /studio/shows/[slug]/episodes/[id]
 *     to debug failed generations ohne DB-Tool.
 *
 * Not part of the public Canzoia API — signed requests go to
 * /api/canzoia/jobs/[jobId] (pollable status) + /api/canzoia/jobs/[jobId]/audio.mp3
 * (proxied audio). This route exists so an admin can see *everything*
 * without needing to remember the canzoiaJobId or hit the proxy.
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug, id } = await ctx.params;

  const episode = await prisma.showEpisode.findUnique({
    where: { id },
    include: {
      show: { select: { id: true, slug: true, title: true } },
      showFokus: {
        select: {
          id: true,
          displayLabel: true,
          enabled: true,
          fokusTemplate: { select: { displayName: true, emoji: true } },
        },
      },
    },
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

  return Response.json({
    episode: {
      id: episode.id,
      canzoiaJobId: episode.canzoiaJobId,
      idempotencyKey: episode.idempotencyKey,
      canzoiaProfileId: episode.canzoiaProfileId,
      showRevisionHash: episode.showRevisionHash,

      status: episode.status,
      progressPct: episode.progressPct,
      progressStage: episode.progressStage,

      title: episode.title,
      text: episode.text,
      audioUrl: episode.audioUrl,
      durationSec: episode.durationSec,
      timeline: episode.timeline,

      promptSystem: episode.promptSystem,
      promptUser: episode.promptUser,

      userInputs: episode.userInputs,
      profileSnapshot: episode.profileSnapshot,

      inputTokens: episode.inputTokens,
      outputTokens: episode.outputTokens,
      ttsChars: episode.ttsChars,
      totalMinutesBilled: episode.totalMinutesBilled,

      errorCode: episode.errorCode,
      errorMessage: episode.errorMessage,

      // Review-Gate (Feature S3) + Continuity (Feature #4): Pilot-Episoden werden
      // NACH der Generation im Studio inspiziert, der Admin approved oder rejected
      // bevor der Canzoia-Webhook feuert. Topics werden fuer die naechste Episode
      // (Continuity-Mode) als Context genutzt.
      isPilot: episode.isPilot,
      reviewStatus: episode.reviewStatus,
      reviewedAt: episode.reviewedAt,
      reviewedBy: episode.reviewedBy,
      reviewNotes: episode.reviewNotes,
      topics: episode.topics,
      continuityNotes: episode.continuityNotes,

      createdAt: episode.createdAt,
      startedAt: episode.startedAt,
      completedAt: episode.completedAt,

      show: episode.show,
      showFokus: {
        id: episode.showFokus.id,
        label:
          episode.showFokus.displayLabel ??
          episode.showFokus.fokusTemplate.displayName,
        emoji: episode.showFokus.fokusTemplate.emoji,
        enabled: episode.showFokus.enabled,
      },
    },
  });
}
