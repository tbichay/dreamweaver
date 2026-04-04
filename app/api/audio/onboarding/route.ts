import { list, getDownloadUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Public proxy for the onboarding audio — no auth needed.
// Supports range requests for proper browser audio playback.
export async function GET(request: Request) {
  try {
    const { blobs } = await list({ prefix: "audio/onboarding-willkommen.wav", limit: 1 });

    if (blobs.length === 0) {
      return new Response("Onboarding audio not yet generated", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const blobMeta = blobs[0];
    const totalSize = blobMeta.size;
    const rangeHeader = request.headers.get("Range");

    // Get a signed download URL for the private blob
    const downloadUrl = await getDownloadUrl(blobMeta.url);

    if (rangeHeader) {
      // Parse range request (e.g. "bytes=0-1023")
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        // Fetch the range from the blob
        const rangeRes = await fetch(downloadUrl, {
          headers: { Range: `bytes=${start}-${end}` },
        });

        if (rangeRes.body) {
          return new Response(rangeRes.body, {
            status: 206,
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": String(chunkSize),
              "Content-Range": `bytes ${start}-${end}/${totalSize}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }

    // Full request — stream the entire file
    const fullRes = await fetch(downloadUrl);

    if (!fullRes.ok || !fullRes.body) {
      console.error("[Onboarding Audio] Download failed:", fullRes.status);
      return new Response("Audio temporarily unavailable", { status: 503 });
    }

    return new Response(fullRes.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Onboarding Audio] Error:", error);
    return new Response("Error fetching onboarding audio", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
