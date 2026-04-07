import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const { geschichteId } = (await request.json()) as { geschichteId: string };

    if (!geschichteId) {
      return Response.json({ error: "geschichteId erforderlich" }, { status: 400 });
    }

    // Verify story exists and has audio
    const geschichte = await prisma.geschichte.findFirst({
      where: { id: geschichteId, userId },
      select: { audioUrl: true, videoUrl: true },
    });

    if (!geschichte) {
      return Response.json({ error: "Geschichte nicht gefunden" }, { status: 404 });
    }

    if (!geschichte.audioUrl) {
      return Response.json({ error: "Geschichte hat noch kein Audio. Bitte zuerst Audio generieren." }, { status: 400 });
    }

    // Already has video?
    if (geschichte.videoUrl) {
      return Response.json({ status: "COMPLETED", videoUrl: `/api/video/film/${geschichteId}` });
    }

    // Check existing job
    const existingJob = await prisma.filmJob.findUnique({
      where: { geschichteId },
    });

    if (existingJob) {
      if (existingJob.status === "COMPLETED" && geschichte.videoUrl) {
        return Response.json({ jobId: existingJob.id, status: "COMPLETED", videoUrl: `/api/video/film/${geschichteId}` });
      }
      if (existingJob.status === "PENDING" || existingJob.status === "PROCESSING") {
        const position = await prisma.filmJob.count({
          where: { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: existingJob.createdAt } },
        });
        return Response.json({
          jobId: existingJob.id,
          status: existingJob.status,
          position,
          progress: existingJob.progress,
          scenesTotal: existingJob.scenesTotal,
          scenesComplete: existingJob.scenesComplete,
        });
      }
      // FAILED or COMPLETED-without-video — reset for retry
      await prisma.filmJob.update({
        where: { id: existingJob.id },
        data: { status: "PENDING", error: null, startedAt: null, completedAt: null, progress: null, scenesComplete: 0 },
      });
      return Response.json({ jobId: existingJob.id, status: "PENDING", position: 0 });
    }

    // Create new job
    const job = await prisma.filmJob.create({
      data: { geschichteId, userId, status: "PENDING" },
    });

    const position = await prisma.filmJob.count({
      where: { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: job.createdAt } },
    });

    console.log(`[Film Queue] New job ${job.id} for story ${geschichteId}, position: ${position}`);

    return Response.json({ jobId: job.id, status: "PENDING", position });
  } catch (error) {
    console.error("Film queue error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 });
  }
}
