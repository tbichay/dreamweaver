import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/profile/[id]/access — List users with access
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

  const zugriffe = await prisma.profilZugriff.findMany({
    where: { hoererProfilId: id },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with user info
  const userIds = zugriffe.map((z) => z.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return Response.json(
    zugriffe.map((z) => ({
      ...z,
      user: userMap.get(z.userId) ?? { name: null, email: "Unbekannt" },
    }))
  );
}

// DELETE /api/profile/[id]/access — Revoke access
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const accessId = searchParams.get("accessId");

  if (!accessId) {
    return Response.json({ error: "accessId erforderlich" }, { status: 400 });
  }

  // Verify ownership
  const profil = await prisma.hoererProfil.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profil) {
    return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.profilZugriff.delete({ where: { id: accessId } });

  // Also revoke the corresponding invitation
  const zugriff = await prisma.profilZugriff.findUnique({ where: { id: accessId } }).catch(() => null);
  if (zugriff) {
    await prisma.profilEinladung.updateMany({
      where: {
        hoererProfilId: id,
        acceptedById: zugriff.userId,
        status: "ACCEPTED",
      },
      data: { status: "REVOKED" },
    });
  }

  return Response.json({ success: true });
}
