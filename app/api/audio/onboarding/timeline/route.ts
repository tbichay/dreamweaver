import { list, get } from "@vercel/blob";

// Public proxy for the onboarding timeline — no auth needed
export async function GET() {
  try {
    const { blobs } = await list({ prefix: "audio/onboarding-willkommen-timeline", limit: 1 });

    if (blobs.length === 0) {
      return Response.json([], {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    const blobMeta = blobs[0];
    const result = await get(blobMeta.url, { access: "private" });
    if (!result) {
      return Response.json([]);
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400", // 24h cache
      },
    });
  } catch (error) {
    console.error("[Timeline] Error:", error);
    return Response.json([], { status: 500 });
  }
}
