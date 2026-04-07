import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;

  const { id } = await params;

  const geschichte = await prisma.geschichte.findUnique({
    where: { id },
    select: { audioUrl: true, userId: true, shareSlug: true, hoererProfilId: true },
  });

  if (!geschichte || !geschichte.audioUrl) {
    return new Response("Not found", { status: 404 });
  }

  // Zugriff: Owner ODER geteilte Geschichte (hat shareSlug) ODER Profil-Zugriff
  const isOwner = userId && geschichte.userId === userId;
  const isPublicShared = !!geschichte.shareSlug;
  let hasProfilAccess = false;

  if (!isOwner && !isPublicShared && userId) {
    const zugriff = await prisma.profilZugriff.findFirst({
      where: { hoererProfilId: geschichte.hoererProfilId, userId },
    });
    hasProfilAccess = !!zugriff;
  }

  if (!isOwner && !isPublicShared && !hasProfilAccess) {
    return new Response(userId ? "Forbidden" : "Unauthorized", { status: userId ? 403 : 401 });
  }

  try {
    const result = await get(geschichte.audioUrl, { access: "private" });

    if (!result || !result.stream) {
      console.error("[Audio Proxy] Blob not found or empty:", geschichte.audioUrl);
      return new Response("Audio not found", { status: 404 });
    }

    // Read full buffer so we can serve with Content-Length (required for seeking)
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);

    const contentType = result.blob.contentType || "audio/mpeg";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Audio Proxy] Error:", error);
    return new Response("Error fetching audio", { status: 500 });
  }
}
