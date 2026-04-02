import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profil = await prisma.hoererProfil.findFirst({
    where: { id, userId },
  });

  if (!profil) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(profil);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await request.json();

  const profil = await prisma.hoererProfil.updateMany({
    where: { id, userId },
    data: {
      name: data.name,
      geburtsdatum: data.geburtsdatum ? new Date(data.geburtsdatum) : undefined,
      alter: data.alter ?? undefined,
      geschlecht: data.geschlecht || null,
      interessen: data.interessen || [],
      lieblingsfarbe: data.lieblingsfarbe || null,
      lieblingstier: data.lieblingstier || null,
      charaktereigenschaften: data.charaktereigenschaften || [],
      herausforderungen: data.herausforderungen || [],
      tags: data.tags || [],
    },
  });

  return Response.json(profil);
}
