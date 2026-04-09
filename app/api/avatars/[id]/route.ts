import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Public proxy for avatar images (private blob store)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try as user ID first, then profile ID
  let avatarUrl: string | null = null;

  const user = await prisma.user.findUnique({ where: { id }, select: { image: true } });
  if (user?.image) {
    avatarUrl = user.image;
  } else {
    const profile = await prisma.hoererProfil.findUnique({ where: { id }, select: { avatarUrl: true } });
    if (profile?.avatarUrl) avatarUrl = profile.avatarUrl;
  }

  if (!avatarUrl) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const result = await get(avatarUrl, { access: "private" });
    if (!result?.stream) return new Response("Not found", { status: 404 });

    // Read full buffer for proper Content-Length
    const chunks: Uint8Array[] = [];
    const reader = result.stream.getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; if (value) chunks.push(value); }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        "Content-Type": result.blob.contentType || "image/webp",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
