import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const AVG_GENERATION_MINUTES = 2;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.generationJob.findUnique({
    where: { id },
    include: {
      geschichte: {
        select: { id: true, audioUrl: true, audioDauerSek: true, timeline: true, titel: true },
      },
    },
  });

  if (!job) {
    return Response.json({ error: "Job nicht gefunden" }, { status: 404 });
  }

  if (job.userId !== session.user.id) {
    return Response.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  if (job.status === "COMPLETED") {
    return Response.json({
      status: "COMPLETED",
      audioUrl: `/api/audio/${job.geschichteId}`,
      audioDauerSek: job.geschichte.audioDauerSek,
      timeline: job.geschichte.timeline,
      titel: job.geschichte.titel,
    });
  }

  if (job.status === "FAILED") {
    // Detect specific error types for better user messaging
    const errorMsg = job.error || "Unbekannter Fehler";
    let userMessage = errorMsg;
    let errorType = "unknown";

    if (errorMsg.includes("quota_exceeded") || errorMsg.includes("quota")) {
      userMessage = "Das Audio-Kontingent ist vorübergehend aufgebraucht. Bitte versuche es später erneut.";
      errorType = "quota";
    } else if (errorMsg.includes("429") || errorMsg.includes("rate_limit") || errorMsg.includes("Too many")) {
      userMessage = "Zu viele gleichzeitige Anfragen. Deine Geschichte wird automatisch erneut versucht.";
      errorType = "rate_limit";
    } else if (errorMsg.includes("Timeout") || errorMsg.includes("timeout")) {
      userMessage = "Die Generierung hat zu lange gedauert. Wird automatisch erneut versucht.";
      errorType = "timeout";
    }

    return Response.json({
      status: "FAILED",
      error: userMessage,
      errorType,
      retryCount: job.retryCount,
      canRetry: job.retryCount < 3,
    });
  }

  // PENDING or PROCESSING
  const position = await prisma.generationJob.count({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      createdAt: { lt: job.createdAt },
    },
  });

  const estimatedMinutes = job.status === "PROCESSING"
    ? AVG_GENERATION_MINUTES
    : (position + 1) * AVG_GENERATION_MINUTES;

  // How long has it been processing?
  const processingSeconds = job.status === "PROCESSING" && job.startedAt
    ? Math.round((Date.now() - job.startedAt.getTime()) / 1000)
    : 0;

  return Response.json({
    status: job.status,
    position: job.status === "PROCESSING" ? 0 : position,
    estimatedMinutes,
    processingSeconds,
    retryCount: job.retryCount,
    step: job.status === "PROCESSING"
      ? processingSeconds < 10 ? "Vorbereitung..."
        : processingSeconds < 30 ? "Stimmen werden generiert..."
        : processingSeconds < 90 ? "Charaktere sprechen ihren Text..."
        : processingSeconds < 180 ? "Sound-Effekte werden hinzugefügt..."
        : "Audio wird zusammengemischt..."
      : job.status === "PENDING"
        ? "In der Warteschlange"
        : undefined,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
