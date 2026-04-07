import { auth } from "@/lib/auth";
import { list, del } from "@vercel/blob";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

interface Asset {
  name: string;
  path: string;
  type: "image" | "video" | "audio";
  category: string;
  size: number;
  url: string;
  blobUrl: string;
  uploadedAt: string;
}

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;
  return true;
}

// GET: List all assets
export async function GET() {
  if (!(await checkAdmin())) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const assets: Asset[] = [];

  const prefixes = [
    { prefix: "images/", category: "portrait" },
    { prefix: "studio/scene-images/", category: "landscape" },
    { prefix: "studio/hero/", category: "background" },
    { prefix: "studio/icons/", category: "branding" },
    { prefix: "studio/branding-source/", category: "branding" },
    { prefix: "marketing-videos/", category: "marketing-video" },
    { prefix: "help-clips/", category: "help-clip" },
    { prefix: "audio/onboarding", category: "audio" },
    { prefix: "intros/", category: "intro" },
    { prefix: "outros/", category: "outro" },
  ];

  // Studio portraits (exclude sub-folders like hero/, scene-images/, branding-source/, icons/)
  try {
    const { blobs } = await list({ prefix: "studio/", limit: 100 });
    for (const blob of blobs) {
      // Only include direct children of studio/ (portraits + hero images)
      const subPath = blob.pathname.replace("studio/", "");
      if (subPath.includes("/")) continue; // skip sub-folders (already handled above)

      const fileName = blob.pathname.split("/").pop() || blob.pathname;
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      if (ext === "json") continue;

      assets.push({
        name: fileName,
        path: blob.pathname,
        type: "image",
        category: "portrait",
        size: blob.size,
        url: `/api/admin/studio/image/${fileName}`,
        blobUrl: blob.url,
        uploadedAt: blob.uploadedAt?.toISOString() || "",
      });
    }
  } catch { /* skip */ }

  for (const { prefix, category } of prefixes) {
    try {
      const { blobs } = await list({ prefix, limit: 100 });
      for (const blob of blobs) {
        const fileName = blob.pathname.split("/").pop() || blob.pathname;
        const ext = fileName.split(".").pop()?.toLowerCase() || "";

        if (ext === "json") continue;

        const assetType: "image" | "video" | "audio" =
          ["mp4", "webm", "mov"].includes(ext) ? "video" :
          ["mp3", "wav", "ogg"].includes(ext) ? "audio" : "image";

        // Build the correct serve URL based on category + prefix
        let url = "";
        if (prefix === "images/") {
          url = `/api/images/${fileName}`;
        } else if (category === "landscape") {
          url = `/api/admin/studio/image/scene-images/${fileName}`;
        } else if (category === "background") {
          url = `/api/admin/studio/image/hero/${fileName}`;
        } else if (category === "branding" && prefix === "studio/icons/") {
          url = `/api/admin/studio/image/icons/${fileName}`;
        } else if (category === "branding") {
          url = `/api/admin/studio/image/branding-source/${fileName}`;
        } else if (category === "marketing-video") {
          url = `/api/video/marketing/${fileName.replace(".mp4", "")}`;
        } else if (category === "help-clip") {
          url = `/api/audio/help/${fileName.replace(".mp3", "")}`;
        } else if (category === "audio") {
          url = "/api/audio/onboarding";
        } else if (category === "intro" || category === "outro") {
          url = blob.downloadUrl || "";
        } else {
          url = blob.downloadUrl || "";
        }

        assets.push({
          name: fileName,
          path: blob.pathname,
          type: assetType,
          category,
          size: blob.size,
          url,
          blobUrl: blob.url,
          uploadedAt: blob.uploadedAt?.toISOString() || "",
        });
      }
    } catch { /* skip */ }
  }

  // Film scenes
  try {
    const { blobs } = await list({ prefix: "films/", limit: 200 });
    for (const blob of blobs) {
      if (!blob.pathname.endsWith(".mp4")) continue;
      const parts = blob.pathname.split("/");
      const fileName = parts.pop() || "";
      const geschichteId = parts[1] || "";
      const match = fileName.match(/scene-(\d+)/);
      const idx = match ? parseInt(match[1]) : 0;

      assets.push({
        name: fileName,
        path: blob.pathname,
        type: "video",
        category: "film-scene",
        size: blob.size,
        url: `/api/video/film-scene/${geschichteId}/${idx}`,
        blobUrl: blob.url,
        uploadedAt: blob.uploadedAt?.toISOString() || "",
      });
    }
  } catch { /* skip */ }

  // Group
  const grouped: Record<string, Asset[]> = {};
  for (const asset of assets) {
    if (!grouped[asset.category]) grouped[asset.category] = [];
    grouped[asset.category].push(asset);
  }

  return Response.json({
    assets,
    grouped,
    stats: {
      total: assets.length,
      images: assets.filter((a) => a.type === "image").length,
      videos: assets.filter((a) => a.type === "video").length,
      audio: assets.filter((a) => a.type === "audio").length,
      totalSize: assets.reduce((s, a) => s + a.size, 0),
    },
  });
}

// DELETE: Remove an asset from blob
export async function DELETE(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const blobUrl = searchParams.get("blobUrl");

  if (!blobUrl) return Response.json({ error: "blobUrl required" }, { status: 400 });

  try {
    await del(blobUrl);
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 });
  }
}
