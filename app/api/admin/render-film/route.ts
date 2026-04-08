import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { list } from "@vercel/blob";

export const maxDuration = 300;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

// GET: Get render instructions + clip list for a story
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const geschichteId = searchParams.get("geschichteId");
  if (!geschichteId) return Response.json({ error: "geschichteId required" }, { status: 400 });

  // Get story info
  const geschichte = await prisma.geschichte.findUnique({
    where: { id: geschichteId },
    select: { titel: true, audioDauerSek: true },
  });

  // Get all clips
  const { blobs } = await list({ prefix: `films/${geschichteId}/scene-`, limit: 100 });
  const clips = blobs
    .filter((b) => b.pathname.endsWith(".mp4"))
    .map((b) => {
      const match = b.pathname.match(/scene-(\d+)\.mp4$/);
      return {
        sceneIndex: match ? parseInt(match[1]) : -1,
        pathname: b.pathname,
        size: b.size,
        url: `/api/video/film-scene/${geschichteId}/${match ? parseInt(match[1]) : 0}`,
        downloadUrl: b.downloadUrl,
      };
    })
    .filter((c) => c.sceneIndex >= 0)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);

  // Deduplicate
  const seen = new Map<number, typeof clips[0]>();
  for (const clip of clips) {
    const existing = seen.get(clip.sceneIndex);
    if (!existing || clip.size > existing.size) seen.set(clip.sceneIndex, clip);
  }
  const uniqueClips = [...seen.values()].sort((a, b) => a.sceneIndex - b.sceneIndex);

  return Response.json({
    geschichte: { titel: geschichte?.titel, audioDauerSek: geschichte?.audioDauerSek },
    clips: uniqueClips,
    totalClips: uniqueClips.length,
    totalSize: uniqueClips.reduce((s, c) => s + c.size, 0),
    renderCommand: `node scripts/master-film.mjs ${geschichteId}`,
    instructions: [
      "1. Stelle sicher dass der Dev-Server laeuft (npm run dev)",
      "2. Oeffne ein Terminal im Projekt-Ordner",
      `3. Fuehre aus: node scripts/master-film.mjs ${geschichteId}`,
      "4. Der Film wird in tmp/films/<id>/master/ gespeichert",
      "5. Lade den fertigen Film hoch oder teile ihn direkt",
    ],
  });
}

// POST: Render film using Remotion (assembles clips into final video)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { geschichteId, format = "portrait" } = await request.json() as {
      geschichteId: string;
      format?: "portrait" | "wide";
    };

    const geschichte = await prisma.geschichte.findUnique({
      where: { id: geschichteId },
      select: {
        id: true,
        titel: true,
        audioUrl: true,
        filmScenes: true,
        hoererProfil: { select: { name: true } },
      },
    });

    if (!geschichte) {
      return Response.json({ error: "Geschichte nicht gefunden" }, { status: 404 });
    }

    const scenes = (geschichte.filmScenes as unknown as Array<{
      type: string;
      characterId?: string;
      audioStartMs: number;
      audioEndMs: number;
      videoUrl?: string;
    }>) || [];

    const renderableScenes = scenes
      .map((scene, i) => ({
        videoUrl: scene.videoUrl || `/api/video/film-scene/${geschichteId}/${i}`,
        durationMs: Math.max(scene.audioEndMs - scene.audioStartMs, 3000),
        type: scene.type,
        characterId: scene.characterId,
      }))
      .filter((s) => s.durationMs > 0);

    if (renderableScenes.length < 2) {
      return Response.json({ error: "Mindestens 2 Clips noetig" }, { status: 400 });
    }

    console.log(`[Render] Rendering "${geschichte.titel}" (${renderableScenes.length} scenes, ${format})`);

    // Convert relative URLs to full URLs for Lambda access
    const baseUrl = process.env.AUTH_URL || "https://www.koalatree.ai";
    const fullScenes = renderableScenes.map((s) => ({
      ...s,
      videoUrl: s.videoUrl.startsWith("http") ? s.videoUrl : `${baseUrl}${s.videoUrl}`,
    }));
    const storyAudioFullUrl = geschichte.audioUrl ? `${baseUrl}/api/audio/${geschichteId}` : undefined;

    // Check if Lambda is configured
    if (process.env.REMOTION_AWS_ACCESS_KEY_ID && process.env.REMOTION_SERVE_URL) {
      // ══════ REMOTION LAMBDA ══════
      const { renderFilmOnLambda } = await import("@/lib/film-render");

      const outputUrl = await renderFilmOnLambda({
        geschichteId,
        scenes: fullScenes,
        storyAudioUrl: storyAudioFullUrl,
        title: geschichte.titel || "KoalaTree",
        subtitle: geschichte.hoererProfil?.name ? `fuer ${geschichte.hoererProfil.name}` : "praesentiert",
        format,
      });

      // Save to DB
      await prisma.geschichte.update({
        where: { id: geschichteId },
        data: { videoUrl: outputUrl },
      });

      return Response.json({
        status: "completed",
        videoUrl: `/api/video/film/${geschichteId}`,
        outputUrl,
        scenes: renderableScenes.length,
      });
    }

    // ══════ FALLBACK: Local render instructions ══════
    return Response.json({
      status: "manual",
      scenes: renderableScenes.length,
      localScript: `node scripts/render-film.mjs ${geschichteId}`,
      message: "Remotion Lambda nicht konfiguriert. Setze REMOTION_AWS_ACCESS_KEY_ID, REMOTION_AWS_SECRET_ACCESS_KEY und REMOTION_SERVE_URL in Vercel, oder rendere lokal.",
    });
  } catch (error) {
    console.error("[Render] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Render-Fehler" },
      { status: 500 },
    );
  }
}
