import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Owned profiles
  const ownedProfiles = await prisma.hoererProfil.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Shared profiles (via ProfilZugriff)
  const zugriffe = await prisma.profilZugriff.findMany({
    where: { userId },
    include: {
      hoererProfil: true,
    },
  });

  // Map owned profiles with rolle
  const ownedMapped = ownedProfiles.map((p) => ({
    ...p,
    avatarUrl: p.avatarUrl ? `/api/avatars/${p.id}` : null,
    rolle: "BESITZER" as const,
    isShared: false,
  }));

  // Map shared profiles — filter out private fields based on sichtbarkeit
  const sharedMapped = zugriffe
    .filter((z) => z.hoererProfil.userId !== userId) // exclude own profiles
    .map((z) => {
      const p = z.hoererProfil;
      const sichtbar = new Set(z.sichtbarkeit);
      return {
        ...p,
        avatarUrl: p.avatarUrl ? `/api/avatars/${p.id}` : null,
        // Filter private fields based on sichtbarkeit
        interessen: sichtbar.has("interessen") ? p.interessen : [],
        charaktereigenschaften: sichtbar.has("charaktereigenschaften") ? p.charaktereigenschaften : [],
        herausforderungen: sichtbar.has("herausforderungen") ? p.herausforderungen : [],
        tags: sichtbar.has("tags") ? p.tags : [],
        rolle: z.rolle,
        isShared: true,
        sichtbarkeit: z.sichtbarkeit,
      };
    });

  return Response.json([...ownedMapped, ...sharedMapped], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const data = await request.json();

  // Duplikat-Check: gleicher Name für diesen User
  const existing = await prisma.hoererProfil.findFirst({
    where: { userId, name: data.name },
  });
  if (existing) {
    return Response.json(
      { error: "Ein Profil mit diesem Namen existiert bereits" },
      { status: 409 }
    );
  }

  const profil = await prisma.hoererProfil.create({
    data: {
      userId,
      name: data.name,
      geburtsdatum: data.geburtsdatum ? new Date(data.geburtsdatum) : null,
      alter: data.alter ?? null,
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

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ID required" }, { status: 400 });

  await prisma.hoererProfil.deleteMany({
    where: { id, userId },
  });

  return Response.json({ ok: true });
}
