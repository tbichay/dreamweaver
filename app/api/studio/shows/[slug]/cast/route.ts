/**
 * Show-Cast API — Add/Remove/Update which Actors are cast in a Show.
 *
 * POST   /api/studio/shows/[slug]/cast         — add actor (body: { actorId, role? })
 * PATCH  /api/studio/shows/[slug]/cast         — bulk replace cast (body: { cast: [{actorId, role?, orderIndex}] })
 * DELETE /api/studio/shows/[slug]/cast?actorId=…  — remove one actor from cast
 */

import { prisma } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/studio/admin-auth";
import { bumpRevisionHash } from "@/lib/studio/show-revision";

type Ctx = { params: Promise<{ slug: string }> };

async function loadShow(slug: string) {
  return prisma.show.findUnique({ where: { slug } });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await loadShow(slug);
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const body = await request.json() as {
    actorId: string;
    role?: string | null;
    styleOverride?: string | null;
  };
  if (!body.actorId) return Response.json({ error: "actorId fehlt" }, { status: 400 });

  const existing = await prisma.showActor.findUnique({
    where: { showId_actorId: { showId: show.id, actorId: body.actorId } },
  });
  if (existing) return Response.json({ cast: existing, existed: true });

  const maxOrder = await prisma.showActor.aggregate({
    where: { showId: show.id },
    _max: { orderIndex: true },
  });

  const cast = await prisma.showActor.create({
    data: {
      showId: show.id,
      actorId: body.actorId,
      role: body.role ?? null,
      styleOverride: body.styleOverride ?? null,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
  });

  await prisma.show.update({
    where: { id: show.id },
    data: { revisionHash: bumpRevisionHash(show.revisionHash) },
  });

  return Response.json({ cast }, { status: 201 });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await loadShow(slug);
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const body = await request.json() as {
    cast: Array<{ actorId: string; role?: string | null; styleOverride?: string | null; orderIndex?: number }>;
  };
  if (!Array.isArray(body.cast)) {
    return Response.json({ error: "cast muss Array sein" }, { status: 400 });
  }

  // Replace-all: delete existing, insert new.
  await prisma.$transaction([
    prisma.showActor.deleteMany({ where: { showId: show.id } }),
    ...body.cast.map((entry, idx) =>
      prisma.showActor.create({
        data: {
          showId: show.id,
          actorId: entry.actorId,
          role: entry.role ?? null,
          styleOverride: entry.styleOverride ?? null,
          orderIndex: entry.orderIndex ?? idx,
        },
      })
    ),
    prisma.show.update({
      where: { id: show.id },
      data: { revisionHash: bumpRevisionHash(show.revisionHash) },
    }),
  ]);

  const updated = await prisma.showActor.findMany({
    where: { showId: show.id },
    include: { actor: true },
    orderBy: { orderIndex: "asc" },
  });
  return Response.json({ cast: updated });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { slug } = await ctx.params;
  const show = await loadShow(slug);
  if (!show) return Response.json({ error: "Show nicht gefunden" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get("actorId");
  if (!actorId) return Response.json({ error: "actorId fehlt" }, { status: 400 });

  await prisma.showActor.deleteMany({
    where: { showId: show.id, actorId },
  });
  await prisma.show.update({
    where: { id: show.id },
    data: { revisionHash: bumpRevisionHash(show.revisionHash) },
  });

  return Response.json({ deleted: true });
}
