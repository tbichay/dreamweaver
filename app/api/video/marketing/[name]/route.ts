import { list, get } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
    const { blobs } = await list({ prefix: `marketing-videos/${name}`, limit: 3 });
    const videoBlob = blobs.find((b) => b.pathname.endsWith(".mp4"));

    if (!videoBlob) {
      return new Response("Video not found", { status: 404 });
    }

    const result = await get(videoBlob.url, { access: "private" });
    if (!result?.stream) {
      return new Response("Video unavailable", { status: 503 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": "video/mp4",
        ...(result.blob.size ? { "Content-Length": String(result.blob.size) } : {}),
        "Cache-Control": "public, max-age=604800", // 1 week
      },
    });
  } catch (error) {
    console.error(`[Video] Error serving ${name}:`, error);
    return new Response("Error", { status: 500 });
  }
}
