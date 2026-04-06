import { prisma } from "@/lib/db";
import { generateFilm } from "@/lib/video-pipeline";
import { Resend } from "resend";

export const maxDuration = 300; // 5 minutes

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = process.env.EMAIL_FROM || "KoalaTree <noreply@koalatree.ai>";
const STALE_MINUTES = 10; // Films take longer than audio

function getBaseUrl(): string {
  return process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://www.koalatree.ai";
}

export async function GET(request: Request) {
  // Auth: Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Reset stale jobs
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const staleJobs = await prisma.filmJob.findMany({
      where: { status: "PROCESSING", startedAt: { lt: staleThreshold } },
    });

    for (const stale of staleJobs) {
      if (stale.retryCount < 2) {
        await prisma.filmJob.update({
          where: { id: stale.id },
          data: { status: "PENDING", retryCount: { increment: 1 }, startedAt: null, error: "Timeout — wird erneut versucht" },
        });
      } else {
        await prisma.filmJob.update({
          where: { id: stale.id },
          data: { status: "FAILED", error: "Maximale Versuche erreicht", completedAt: new Date() },
        });
      }
    }

    // 2. Check if a job is already processing
    const processing = await prisma.filmJob.findFirst({ where: { status: "PROCESSING" } });
    if (processing) {
      return Response.json({ status: "busy", jobId: processing.id });
    }

    // 3. Get next pending job
    const nextJob = await prisma.filmJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { geschichte: { select: { titel: true, hoererProfil: { select: { name: true } } } } },
    });

    if (!nextJob) {
      return Response.json({ status: "idle" });
    }

    // 4. Mark as processing
    await prisma.filmJob.update({
      where: { id: nextJob.id },
      data: { status: "PROCESSING", startedAt: new Date(), progress: "Szenen werden analysiert..." },
    });

    console.log(`[Film Cron] Processing job ${nextJob.id} for "${nextJob.geschichte.titel}"`);

    // 5. Generate film
    const result = await generateFilm(nextJob.geschichteId);

    // 6. Update story with video URL
    await prisma.geschichte.update({
      where: { id: nextJob.geschichteId },
      data: { videoUrl: result.videoUrl, filmScenes: JSON.parse(JSON.stringify(result.scenes)) },
    });

    // 7. Mark as completed
    await prisma.filmJob.update({
      where: { id: nextJob.id },
      data: { status: "COMPLETED", completedAt: new Date(), progress: "Fertig!", scenesTotal: result.scenes.length, scenesComplete: result.scenes.length },
    });

    console.log(`[Film Cron] Completed! ${result.scenes.length} scenes, ${result.totalDurationSek}s`);

    // 8. Email notification
    try {
      const user = await prisma.user.findUnique({
        where: { id: nextJob.userId },
        select: { email: true },
      });

      if (user?.email) {
        const profilName = nextJob.geschichte.hoererProfil?.name || "Dein Kind";
        const title = nextJob.geschichte.titel || "Neue Geschichte";

        await resend.emails.send({
          from: emailFrom,
          to: user.email,
          subject: `${profilName}s Film ist fertig!`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #1a2e1a; color: #f5eed6; border-radius: 16px;">
              <h1 style="font-size: 20px; text-align: center;">KoalaTree</h1>
              <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin: 16px 0;">
                <p style="font-size: 16px; color: #a8d5b8; font-weight: 600;">${title}</p>
                <p style="font-size: 14px; color: rgba(255,255,255,0.6);">
                  Der Film fuer ${profilName} ist fertig! ${result.scenes.length} Szenen warten darauf, angeschaut zu werden.
                </p>
              </div>
              <div style="text-align: center;">
                <a href="${getBaseUrl()}/geschichten" style="display: inline-block; background: #4a7c59; color: #f5eed6; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600;">Film anschauen</a>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("[Film Cron] Email failed:", emailErr);
    }

    return Response.json({ status: "processed", jobId: nextJob.id, scenes: result.scenes.length });
  } catch (error) {
    console.error("[Film Cron] Error:", error);

    // Mark failed
    try {
      const failedJob = await prisma.filmJob.findFirst({ where: { status: "PROCESSING" } });
      if (failedJob) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        await prisma.filmJob.update({
          where: { id: failedJob.id },
          data: failedJob.retryCount < 2
            ? { status: "PENDING", retryCount: { increment: 1 }, startedAt: null, error: msg }
            : { status: "FAILED", error: msg, completedAt: new Date() },
        });
      }
    } catch { /* ignore */ }

    return Response.json({ status: "error", error: String(error) }, { status: 500 });
  }
}
