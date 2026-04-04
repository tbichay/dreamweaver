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
  try {
    const { blobs } = await list({ prefix: `studio/${filename}`, limit: 1 });
    if (blobs.length > 0) {
      const result = await get(blobs[0].url, { access: "private" });
      if (result && result.statusCode === 200 && result.stream) {
        return new Response(result.stream, {
          headers: {
            "Content-Type": result.blob.contentType || "image/png",
            "Content-Length": String(result.blob.size),
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
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
