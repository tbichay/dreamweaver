import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { list } from "@vercel/blob";

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
