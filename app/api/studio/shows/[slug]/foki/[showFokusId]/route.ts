/**
 * Single-ShowFokus API — fine-tuning one Fokus entry on a Show.
 *
 * PATCH  /api/studio/shows/[slug]/foki/[showFokusId]
 *   body: { showOverlay?, castRoles?, userInputSchema?, targetDurationMin?, displayLabel? }
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { bumpRevisionHash } from "@/lib/studio/show-revision";

type Ctx = { params: Promise<{ slug: string; showFokusId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug, showFokusId } = await ctx.params;
  const show = await prisma.show.findUnique({ where: { slug } });
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const body = await request.json() as {
    showOverlay?: string;
    castRoles?: unknown;
    userInputSchema?: unknown;
    targetDurationMin?: number;
    displayLabel?: string | null;
    enabled?: boolean;
  };

  const fokus = await prisma.showFokus.update({
    where: { id: showFokusId },
    data: {
      ...(body.showOverlay !== undefined && { showOverlay: body.showOverlay }),
      ...(body.castRoles !== undefined && { castRoles: body.castRoles as object }),
      ...(body.userInputSchema !== undefined && { userInputSchema: body.userInputSchema as object }),
      ...(body.targetDurationMin !== undefined && { targetDurationMin: body.targetDurationMin }),
      ...(body.displayLabel !== undefined && { displayLabel: body.displayLabel }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
    },
    include: { fokusTemplate: true },
  });

  await prisma.show.update({
    where: { id: show.id },
    data: { revisionHash: bumpRevisionHash(show.revisionHash) },
  });

  return Response.json({ fokus });
}
