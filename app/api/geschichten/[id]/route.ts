import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { del } from "@vercel/blob";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;

  // Try own story first
  let geschichte = await prisma.geschichte.findFirst({
    where: { id, userId },
    include: {
      hoererProfil: {
        select: { id: true, name: true, alter: true, geburtsdatum: true, geschlecht: true },
      },
    },
  });

  // If not own, check shared profile access
  if (!geschichte) {
    const story = await prisma.geschichte.findUnique({
      where: { id },
      include: {
        hoererProfil: {
          select: { id: true, name: true, alter: true, geburtsdatum: true, geschlecht: true },
        },
      },
    });
    if (story) {
      const zugriff = await prisma.profilZugriff.findFirst({
        where: { hoererProfilId: story.hoererProfilId, userId },
      });
      if (zugriff) geschichte = story;
    }
  }

  if (!geschichte) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    ...geschichte,
    audioUrl: geschichte.audioUrl && geschichte.audioUrl !== "local" ? `/api/audio/${geschichte.id}` : null,
    kindProfil: geschichte.hoererProfil,
    isOwn: geschichte.userId === userId,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;

  const geschichte = await prisma.geschichte.findFirst({
    where: { id, userId },
    select: { id: true, audioUrl: true },
  });

  if (!geschichte) return Response.json({ error: "Not found" }, { status: 404 });

  // Delete audio blob if exists
  if (geschichte.audioUrl && geschichte.audioUrl !== "local") {
    try {
      await del(geschichte.audioUrl);
    } catch (err) {
      console.error("[Delete] Blob deletion failed:", err);
      // Continue with DB deletion even if blob fails
    }
  }

  await prisma.geschichte.delete({ where: { id } });

  return Response.json({ deleted: true });
}
