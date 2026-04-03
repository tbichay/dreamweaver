import { list } from "@vercel/blob";

// Public proxy for the onboarding audio — no auth needed
// Finds the blob automatically by prefix instead of relying on env var
export async function GET() {
  try {
    const { blobs } = await list({ prefix: "audio/onboarding-willkommen", limit: 1 });

    if (blobs.length === 0) {
      return new Response("Onboarding audio not yet generated", { status: 404 });
    }

    const blob = blobs[0];

    // Fetch the actual blob data and stream it through
    const response = await fetch(blob.downloadUrl);
    if (!response.ok || !response.body) {
      return new Response("Error fetching onboarding audio", { status: 500 });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(blob.size),
        "Cache-Control": "public, max-age=86400", // Cache for 24h
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("[Onboarding Audio] Error:", error);
    return new Response("Error fetching onboarding audio", { status: 500 });
  }
}
