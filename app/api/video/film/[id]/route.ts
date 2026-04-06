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
  const { id: geschichteId } = await params;

  // Find story
  const geschichte = await prisma.geschichte.findUnique({
    where: { id: geschichteId },
    select: { videoUrl: true, userId: true, shareSlug: true, hoererProfilId: true },
  });

  if (!geschichte?.videoUrl) {
    return new Response("Film not found", { status: 404 });
  }

  // Access check: owner, shared profile, or public share
  const isOwner = userId === geschichte.userId;
  const isPublicShared = !!geschichte.shareSlug;
  let hasAccess = isOwner || isPublicShared;

  if (!hasAccess && userId) {
    const zugriff = await prisma.profilZugriff.findFirst({
      where: { hoererProfilId: geschichte.hoererProfilId, userId },
    });
    hasAccess = !!zugriff;
  }

  if (!hasAccess) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const result = await get(geschichte.videoUrl, { access: "private" });
    if (!result?.stream) return new Response("Video unavailable", { status: 503 });

    return new Response(result.stream, {
      headers: {
        "Content-Type": "video/mp4",
        ...(result.blob.size ? { "Content-Length": String(result.blob.size) } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
