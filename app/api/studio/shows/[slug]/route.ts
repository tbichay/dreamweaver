/**
 * Single-Show API — GET, PATCH, DELETE
 *
 * GET    /api/studio/shows/[slug]  — full show with cast + foki + fokusTemplate+actor joined
 * PATCH  /api/studio/shows/[slug]  — update top-level fields (title, brandVoice, palette, cover…)
 * DELETE /api/studio/shows/[slug]  — cascade delete (Cast + Foki via FK onDelete: Cascade)
 *
 * Cast- and Fokus-changes are handled in the nested routes
 *   /api/studio/shows/[slug]/cast
 *   /api/studio/shows/[slug]/foki
 * to keep the revision-hash bookkeeping localized.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { bumpRevisionHash } from "@/lib/studio/show-revision";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await prisma.show.findUnique({
    where: { slug },
    include: {
      cast: { include: { actor: true }, orderBy: { orderIndex: "asc" } },
      foki: {
        include: { fokusTemplate: true },
        orderBy: { orderIndex: "asc" },
      },
      episodes: { take: 20, orderBy: { createdAt: "desc" } },
    },
  });
  if (!show) return Response.json({ error: "Nicht gefunden" }, { status: 404 });

  return Response.json({ show });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const body = await request.json() as {
    title?: string;
    subtitle?: string | null;
    description?: string;
    category?: string;
    ageBand?: string | null;
    brandVoice?: string;
    palette?: Record<string, string> | null;
    coverUrl?: string | null;
    trailerAudioUrl?: string | null;
    budgetMinutes?: number;
    featuredShowFokusId?: string | null;
    publishedAt?: string | null;
  };

  const existing = await prisma.show.findUnique({ where: { slug } });
  if (!existing) return Response.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.show.update({
    where: { slug },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.ageBand !== undefined && { ageBand: body.ageBand }),
      ...(body.brandVoice !== undefined && { brandVoice: body.brandVoice }),
      ...(body.palette !== undefined && {
        palette: body.palette === null ? Prisma.JsonNull : (body.palette as object),
      }),
      ...(body.coverUrl !== undefined && { coverUrl: body.coverUrl }),
      ...(body.trailerAudioUrl !== undefined && { trailerAudioUrl: body.trailerAudioUrl }),
      ...(body.budgetMinutes !== undefined && { budgetMinutes: body.budgetMinutes }),
      ...(body.featuredShowFokusId !== undefined && { featuredShowFokusId: body.featuredShowFokusId }),
      ...(body.publishedAt !== undefined && {
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      }),
      revisionHash: bumpRevisionHash(existing.revisionHash),
    },
  });

  return Response.json({ show: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const existing = await prisma.show.findUnique({ where: { slug } });
  if (!existing) return Response.json({ error: "Nicht gefunden" }, { status: 404 });

  // Block deletion if episodes exist — safety for data we've delivered.
  const episodeCount = await prisma.showEpisode.count({ where: { showId: existing.id } });
  if (episodeCount > 0) {
    return Response.json(
      { error: `Show hat ${episodeCount} Episoden — lösche die zuerst.` },
      { status: 409 }
    );
  }

  await prisma.show.delete({ where: { slug } });
  return Response.json({ deleted: true });
}
