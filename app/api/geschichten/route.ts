import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const geschichten = await prisma.geschichte.findMany({
    where: { userId },
    include: {
      kindProfil: {
        select: { name: true, alter: true, geschlecht: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(geschichten);
}
