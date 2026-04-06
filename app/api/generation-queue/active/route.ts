import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ jobs: [], filmJobs: [] });

  const userId = session.user.id;

  // Audio jobs
  const activeAudioJobs = await prisma.generationJob.findMany({
    where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
    include: { geschichte: { select: { titel: true, id: true } } },
  });

  const jobs = activeAudioJobs.map((job) => ({
    id: job.id,
    geschichteId: job.geschichteId,
    type: "audio" as const,
    status: job.status,
    titel: job.geschichte.titel,
    step: job.status === "PROCESSING" ? "Audio wird generiert..." : "In der Warteschlange",
  }));

  // Film jobs
  const activeFilmJobs = await prisma.filmJob.findMany({
    where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
    include: { geschichte: { select: { titel: true, id: true } } },
  });

  const filmJobs = activeFilmJobs.map((job) => ({
    id: job.id,
    geschichteId: job.geschichteId,
    type: "film" as const,
    status: job.status,
    titel: job.geschichte.titel,
    progress: job.progress,
    scenesComplete: job.scenesComplete,
    scenesTotal: job.scenesTotal,
    step: job.progress || (job.status === "PROCESSING" ? "Film wird generiert..." : "In der Warteschlange"),
  }));

  return Response.json(
    { jobs: [...jobs, ...filmJobs] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
