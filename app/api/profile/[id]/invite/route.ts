import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/profile/[id]/invite — Create invitation
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { email, sichtbarkeit } = body as { email: string; sichtbarkeit?: string[] };

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Gültige E-Mail erforderlich" }, { status: 400 });
  }

  // Verify ownership
  const profil = await prisma.hoererProfil.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profil) {
    return Response.json({ error: "Profil nicht gefunden oder keine Berechtigung" }, { status: 404 });
  }

  // Check if invitation already exists
  const existing = await prisma.profilEinladung.findFirst({
    where: {
      hoererProfilId: id,
      eingeladenEmail: email.toLowerCase(),
      status: { in: ["PENDING", "ACCEPTED"] },
    },
  });

  if (existing) {
    return Response.json({ error: "Einladung für diese E-Mail existiert bereits" }, { status: 409 });
  }

  // Create invitation
  const einladung = await prisma.profilEinladung.create({
    data: {
      hoererProfilId: id,
      eingeladenEmail: email.toLowerCase(),
      eingeladenVon: session.user.id,
      sichtbarkeit: sichtbarkeit ?? ["interessen", "charaktereigenschaften"],
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  return Response.json({
    token: einladung.token,
    url: `${baseUrl}/einladung/${einladung.token}`,
  });
}

// GET /api/profile/[id]/invite — List invitations for a profile
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const profil = await prisma.hoererProfil.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profil) {
    return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const einladungen = await prisma.profilEinladung.findMany({
    where: { hoererProfilId: id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(einladungen);
}
