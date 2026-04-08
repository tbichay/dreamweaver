import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

/**
 * Upload a video frame image (extracted client-side from the last frame of a clip).
 * Stored as films/{geschichteId}/frame-{sceneIndex}.png for the next clip to use.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const frame = formData.get("frame") as Blob | null;
    const geschichteId = formData.get("geschichteId") as string;
    const sceneIndex = formData.get("sceneIndex") as string;

    if (!frame || !geschichteId || sceneIndex === null) {
      return Response.json({ error: "Missing frame, geschichteId, or sceneIndex" }, { status: 400 });
    }

    const buffer = Buffer.from(await frame.arrayBuffer());
    const paddedIdx = String(parseInt(sceneIndex)).padStart(3, "0");

    const blob = await put(
      `films/${geschichteId}/frame-${paddedIdx}.png`,
      buffer,
      { access: "private", contentType: "image/png", allowOverwrite: true },
    );

    console.log(`[Frame Upload] Saved frame-${paddedIdx}.png for ${geschichteId} (${(buffer.byteLength / 1024).toFixed(0)}KB)`);

    return Response.json({ url: blob.url, size: buffer.byteLength });
  } catch (error) {
    console.error("[Frame Upload] Error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 });
  }
}
