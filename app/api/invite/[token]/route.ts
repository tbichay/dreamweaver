import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/invite/[token] — Get invitation details (public, no auth required for viewing)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const einladung = await prisma.profilEinladung.findUnique({
    where: { token },
    include: {
      hoererProfil: {
        select: { name: true, avatarUrl: true },
      },
    },
  });

  if (!einladung) {
    return Response.json({ error: "Einladung nicht gefunden" }, { status: 404 });
  }

  if (einladung.status === "REVOKED") {
    return Response.json({ error: "Einladung wurde widerrufen" }, { status: 410 });
  }

  if (einladung.status === "ACCEPTED") {
    return Response.json({ error: "Einladung wurde bereits angenommen" }, { status: 409 });
  }

  // Fetch inviter name
  const inviter = await prisma.user.findUnique({
    where: { id: einladung.eingeladenVon },
    select: { name: true, email: true },
  });

  return Response.json({
    profilName: einladung.hoererProfil.name,
    profilAvatar: einladung.hoererProfil.avatarUrl,
    eingeladenVon: inviter?.name || inviter?.email || "Unbekannt",
    sichtbarkeit: einladung.sichtbarkeit,
    status: einladung.status,
  });
}

// POST /api/invite/[token] — Accept invitation (requires auth)
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Bitte melde dich an, um die Einladung anzunehmen" }, { status: 401 });
  }

  const { token } = await params;

  const einladung = await prisma.profilEinladung.findUnique({
    where: { token },
  });

  if (!einladung) {
    return Response.json({ error: "Einladung nicht gefunden" }, { status: 404 });
  }

  if (einladung.status !== "PENDING") {
    return Response.json({ error: "Einladung ist nicht mehr gültig" }, { status: 410 });
  }

  // Don't allow accepting your own profile
  if (einladung.eingeladenVon === session.user.id) {
    return Response.json({ error: "Du kannst deine eigene Einladung nicht annehmen" }, { status: 400 });
  }

  // Check if access already exists
  const existing = await prisma.profilZugriff.findUnique({
    where: {
      hoererProfilId_userId: {
        hoererProfilId: einladung.hoererProfilId,
        userId: session.user.id,
      },
    },
  });

  if (existing) {
    // Update invitation status anyway
    await prisma.profilEinladung.update({
      where: { token },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: session.user.id },
    });
    return Response.json({ success: true, message: "Du hast bereits Zugriff" });
  }

  // Create access + update invitation in transaction
  await prisma.$transaction([
    prisma.profilZugriff.create({
      data: {
        hoererProfilId: einladung.hoererProfilId,
        userId: session.user.id,
        rolle: einladung.rolle,
        sichtbarkeit: einladung.sichtbarkeit,
      },
    }),
    prisma.profilEinladung.update({
      where: { token },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedById: session.user.id,
      },
    }),
  ]);

  return Response.json({ success: true });
}
