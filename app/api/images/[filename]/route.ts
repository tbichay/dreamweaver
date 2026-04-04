import { list, getDownloadUrl } from "@vercel/blob";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public image proxy — serves Studio-generated images from Vercel Blob,
 * falling back to static files in /public/.
 *
 * Flow: Studio generates image → "Verwenden" activates it as canonical →
 * this proxy serves the canonical from Blob → instantly live on website.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Sanitize filename
  if (!filename || !/^[\w-]+\.\w+$/.test(filename)) {
    return new Response("Invalid filename", { status: 400 });
  }

  // 1. Try Vercel Blob (studio-generated canonical images)
  try {
    const exactPath = `studio/${filename}`;
    const { blobs } = await list({ prefix: exactPath, limit: 20 });
    const exactBlob = blobs.find((b) => b.pathname === exactPath);

    if (exactBlob) {
      // Get a signed download URL for the private blob and fetch it
      const downloadUrl = await getDownloadUrl(exactBlob.url);
      const blobRes = await fetch(downloadUrl);

      if (blobRes.ok && blobRes.body) {
        return new Response(blobRes.body, {
          headers: {
            "Content-Type": blobRes.headers.get("Content-Type") || "image/png",
            "Cache-Control": "public, max-age=30, s-maxage=30",
          },
        });
      }
    }
  } catch (err) {
    console.error(`[ImageProxy] Blob error for ${filename}:`, err);
  }

  // 2. Fallback: proxy the static /public/ file via internal fetch
  // On Vercel, /public/ files are at the root URL. The middleware matcher
  // excludes .png files, so this won't loop back to this route.
  try {
    const origin = request.nextUrl.origin;
    const staticRes = await fetch(`${origin}/${filename}`);

    if (staticRes.ok && staticRes.body) {
      return new Response(staticRes.body, {
        headers: {
          "Content-Type": staticRes.headers.get("Content-Type") || "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }
  } catch {
    // Static fallback also failed
  }

  return new Response("Image not found", { status: 404 });
}
