import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ jobs: [] });

  const userId = session.user.id;

  const activeJobs = await prisma.generationJob.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      geschichte: { select: { titel: true, id: true } },
    },
  });

  // Calculate positions
  const allActive = await prisma.generationJob.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, startedAt: true },
  });

  const jobs = activeJobs.map((job) => {
    const position = allActive.findIndex((a) => a.id === job.id);
    const processingSeconds = job.status === "PROCESSING" && job.startedAt
      ? Math.round((Date.now() - job.startedAt.getTime()) / 1000)
      : 0;

    return {
      id: job.id,
      geschichteId: job.geschichteId,
      status: job.status,
      titel: job.geschichte.titel,
      position: Math.max(0, position),
      step: job.status === "PROCESSING"
        ? processingSeconds < 10 ? "Vorbereitung..."
          : processingSeconds < 30 ? "Stimmen werden generiert..."
          : processingSeconds < 90 ? "Charaktere sprechen..."
          : processingSeconds < 180 ? "Sound-Effekte..."
          : "Audio wird gemischt..."
        : undefined,
    };
  });

  return Response.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
}
