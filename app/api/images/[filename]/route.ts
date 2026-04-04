import { list, get } from "@vercel/blob";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Public image proxy — serves Studio-generated images from Vercel Blob,
 * falling back to static files in /public/ if no Studio version exists.
 *
 * This allows the Studio to seamlessly replace website images:
 * generate a new portrait → it's instantly live.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Sanitize filename
  if (!filename || !/^[\w-]+\.\w+$/.test(filename)) {
    return new Response("Invalid filename", { status: 400 });
  }

  // 1. Try Vercel Blob (studio-generated images)
  // We need the EXACT canonical file, not a prefix match that might return versioned files
  try {
    const exactPath = `studio/${filename}`;
    // list() does prefix matching, so "studio/koda-portrait.png" would also match
    // "studio/koda-portrait-1743779850000.png". We fetch a few and find the exact one.
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
  } catch {
    // Blob lookup failed — fall through to static file
  }

  // 2. Fallback to /public/ static file
  try {
    const publicPath = path.join(process.cwd(), "public", filename);
    const buffer = await readFile(publicPath);

    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Image not found", { status: 404 });
  }
}
