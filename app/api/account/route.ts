import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { del, list } from "@vercel/blob";

// GET: Account-Daten
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      tosAcceptedAt: true,
    },
  });

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Proxy-URL für Avatar statt roher Blob-URL
  return Response.json({
    ...user,
    image: user.image ? `/api/avatars/${user.id}` : null,
  });
}

// PUT: Account aktualisieren (Name, Image)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const data = await request.json();

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.image !== undefined && { image: data.image }),
    },
    select: { id: true, email: true, name: true, image: true },
  });

  return Response.json(updated);
}

// DELETE: Account komplett löschen (GDPR)
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { confirmEmail } = await request.json();
  if (confirmEmail?.toLowerCase() !== session.user.email?.toLowerCase()) {
    return Response.json({ error: "Email stimmt nicht überein" }, { status: 400 });
  }

  const userId = session.user.id;

  // 1. Audio-Blobs löschen
  try {
    const geschichten = await prisma.geschichte.findMany({
      where: { userId },
      select: { audioUrl: true },
    });
    for (const g of geschichten) {
      if (g.audioUrl) {
        try { await del(g.audioUrl); } catch { /* blob might not exist */ }
      }
    }
  } catch { /* continue with deletion */ }

  // 2. Daten löschen (Cascade: Profile → Stories → Events)
  await prisma.$transaction([
    prisma.geschichte.deleteMany({ where: { userId } }),
    prisma.hoererProfil.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return Response.json({ ok: true, message: "Account und alle Daten gelöscht" });
}
