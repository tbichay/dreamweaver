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
    // Use head() to get the blob metadata + downloadUrl (supports Range requests for seeking)
    const result = await get(geschichte.audioUrl, { access: "private" });

    if (!result || !result.blob) {
      console.error("[Audio Proxy] Blob not found:", geschichte.audioUrl);
      return new Response("Audio not found", { status: 404 });
    }

    // Redirect to the blob's download URL — it natively supports Range requests,
    // which is required for the browser to seek (set audio.currentTime)
    if (result.blob.downloadUrl) {
      return Response.redirect(result.blob.downloadUrl, 302);
    }

    // Fallback: stream (no seeking support)
    if (!result.stream) {
      return new Response("Audio not found", { status: 404 });
    }

    const contentType = result.blob.contentType || "audio/mpeg";
    const size = result.blob.size || 0;

    return new Response(result.stream, {
      headers: {
        "Content-Type": contentType,
        ...(size > 0 ? { "Content-Length": String(size) } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Audio Proxy] Error:", error);
    return new Response("Error fetching audio", { status: 500 });
  }
}
