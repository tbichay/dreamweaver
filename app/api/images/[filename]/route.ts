import { list, get } from "@vercel/blob";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public image proxy — serves Studio-generated images from Vercel Blob,
 * falling back to static files in /public/ via redirect.
 *
 * This allows the Studio to seamlessly replace website images:
 * generate a new portrait in Studio → activate it → instantly live.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Sanitize filename — allow alphanumeric, hyphens, underscores, dots
  if (!filename || !/^[\w-]+\.\w+$/.test(filename)) {
    console.error(`[ImageProxy] Invalid filename: "${filename}"`);
    return new Response("Invalid filename", { status: 400 });
  }

  // 1. Try Vercel Blob (studio-generated canonical images)
  try {
    const exactPath = `studio/${filename}`;
    // list() does prefix matching, so we fetch a few and find the exact pathname
    const { blobs } = await list({ prefix: exactPath, limit: 20 });
    const exactBlob = blobs.find((b) => b.pathname === exactPath);

    if (exactBlob) {
      const result = await get(exactBlob.url, { access: "private" });
      if (result && result.statusCode === 200 && result.stream) {
        return new Response(result.stream, {
          headers: {
            "Content-Type": result.blob.contentType || "image/png",
            "Content-Length": String(result.blob.size),
            "Cache-Control": "public, max-age=60, s-maxage=60",
          },
        });
      }
    }
  } catch (err) {
    console.error(`[ImageProxy] Blob lookup failed for ${filename}:`, err);
  }

  // 2. Fallback: redirect to static /public/ file
  // On Vercel, /public/ files are served as static assets at the root URL (e.g. /koda-portrait.png).
  // The middleware matcher excludes .png files, so static assets are served directly without auth.
  const origin = request.nextUrl.origin;
  return Response.redirect(`${origin}/${filename}`, 302);
}
