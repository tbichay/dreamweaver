import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const geschichte = await prisma.geschichte.findFirst({
    where: { id, userId },
    include: {
      hoererProfil: {
        select: { id: true, name: true, alter: true, geburtsdatum: true, geschlecht: true },
      },
    },
  });

  if (!geschichte) return Response.json({ error: "Not found" }, { status: 404 });

  // backwards compat
  return Response.json({
    ...geschichte,
    kindProfil: geschichte.hoererProfil,
  });
}
