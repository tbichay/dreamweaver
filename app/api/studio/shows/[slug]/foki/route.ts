/**
 * Show-Foki API — Add/Remove FokusTemplates on a Show.
 *
 * POST   /api/studio/shows/[slug]/foki         — add fokus (body: { fokusTemplateId, showOverlay?, castRoles?, userInputSchema?, targetDurationMin? })
 * PATCH  /api/studio/shows/[slug]/foki         — bulk update order/enabled
 * DELETE /api/studio/shows/[slug]/foki?showFokusId=…
 *
 * Single-fokus customization (prompt overlay, castRoles, inputSchema) lives
 * at /api/studio/shows/[slug]/foki/[showFokusId] so the editor can PATCH
 * just one fokus at a time.
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { bumpRevisionHash } from "@/lib/studio/show-revision";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await prisma.show.findUnique({ where: { slug } });
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const body = await request.json() as {
    fokusTemplateId: string;
    showOverlay?: string;
    castRoles?: unknown;
    userInputSchema?: unknown;
    targetDurationMin?: number;
    displayLabel?: string | null;
  };
  if (!body.fokusTemplateId) return Response.json({ error: "fokusTemplateId fehlt" }, { status: 400 });

  const template = await prisma.fokusTemplate.findUnique({ where: { id: body.fokusTemplateId } });
  if (!template) return Response.json({ error: "FokusTemplate unbekannt" }, { status: 404 });

  const maxOrder = await prisma.showFokus.aggregate({
    where: { showId: show.id },
    _max: { orderIndex: true },
  });

  const fokus = await prisma.showFokus.create({
    data: {
      showId: show.id,
      fokusTemplateId: body.fokusTemplateId,
      showOverlay: body.showOverlay ?? "",
      userInputSchema: (body.userInputSchema ?? template.defaultUserInputSchema) as object,
      castRoles: (body.castRoles ?? template.defaultCastRoles) as object,
      targetDurationMin: body.targetDurationMin ?? template.defaultDurationMin,
      displayLabel: body.displayLabel ?? null,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
    include: { fokusTemplate: true },
  });

  await prisma.show.update({
    where: { id: show.id },
    data: { revisionHash: bumpRevisionHash(show.revisionHash) },
  });

  return Response.json({ fokus }, { status: 201 });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await prisma.show.findUnique({ where: { slug } });
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const body = await request.json() as {
    foki: Array<{ showFokusId: string; orderIndex?: number; enabled?: boolean }>;
  };
  if (!Array.isArray(body.foki)) {
    return Response.json({ error: "foki muss Array sein" }, { status: 400 });
  }

  await prisma.$transaction([
    ...body.foki.map((f) =>
      prisma.showFokus.updateMany({
        where: { id: f.showFokusId, showId: show.id },
        data: {
          ...(f.orderIndex !== undefined && { orderIndex: f.orderIndex }),
          ...(f.enabled !== undefined && { enabled: f.enabled }),
        },
      })
    ),
    prisma.show.update({
      where: { id: show.id },
      data: { revisionHash: bumpRevisionHash(show.revisionHash) },
    }),
  ]);

  const updated = await prisma.showFokus.findMany({
    where: { showId: show.id },
    include: { fokusTemplate: true },
    orderBy: { orderIndex: "asc" },
  });
  return Response.json({ foki: updated });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await prisma.show.findUnique({ where: { slug } });
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const showFokusId = searchParams.get("showFokusId");
  if (!showFokusId) return Response.json({ error: "showFokusId fehlt" }, { status: 400 });

  await prisma.showFokus.deleteMany({ where: { id: showFokusId, showId: show.id } });
  await prisma.show.update({
    where: { id: show.id },
    data: { revisionHash: bumpRevisionHash(show.revisionHash) },
  });

  return Response.json({ deleted: true });
}
