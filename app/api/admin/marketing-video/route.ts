import { auth } from "@/lib/auth";
import { generateVideo, downloadVideo } from "@/lib/hedra";
import { put, list, get } from "@vercel/blob";

export const maxDuration = 300; // 5 minutes

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  return session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Character portrait paths
const PORTRAITS: Record<string, string> = {
  koda: "koda-portrait.png",
  kiki: "kiki-portrait.png",
  luna: "luna-portrait.png",
  mika: "mika-portrait.png",
  pip: "pip-portrait.png",
  sage: "sage-portrait.png",
  nuki: "nuki-portrait.png",
};

const PROMPTS: Record<string, string> = {
  koda: "A wise, warm koala character speaking gently with kind eyes and subtle head movements. Natural blinking and gentle expressions.",
  kiki: "A playful, energetic kookaburra character speaking with enthusiasm. Expressive eyes, occasional head tilts, cheerful demeanor.",
  luna: "A dreamy, gentle owl character speaking softly with wise, calm expressions. Slow blinks, serene movements.",
  mika: "A brave, energetic dingo character speaking with confidence. Alert expressions, occasional ear movements.",
  pip: "A curious, bouncy platypus character speaking with excitement. Wide eyes, eager expressions, animated movements.",
  sage: "A thoughtful, philosophical wombat speaking slowly and deliberately. Deep, contemplative expressions.",
  nuki: "A cheerful, sunny quokka speaking with warmth and joy. Big smile, happy expressions, welcoming demeanor.",
};

// GET: List existing marketing videos
export async function GET() {
  const admin = await isAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { blobs } = await list({ prefix: "marketing-videos/", limit: 50 });
    const videos = blobs
      .filter((b) => b.pathname.endsWith(".mp4"))
      .map((b) => ({
        name: b.pathname.replace("marketing-videos/", "").replace(".mp4", ""),
        url: `/api/video/marketing/${b.pathname.replace("marketing-videos/", "").replace(".mp4", "")}`,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }));

    return Response.json({ videos });
  } catch {
    return Response.json({ videos: [] });
  }
}

// POST: Generate a marketing video for a character
export async function POST(request: Request) {
  const admin = await isAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = await request.json();
    const {
      characterId = "koda",
      audioSource = "onboarding", // "onboarding" or "help-clip:{clipId}"
      aspectRatio = "9:16",
      resolution = "720p",
    } = body as {
      characterId?: string;
      audioSource?: string;
      aspectRatio?: "16:9" | "9:16" | "1:1";
      resolution?: "540p" | "720p";
    };

    if (!PORTRAITS[characterId]) {
      return Response.json({ error: `Unknown character: ${characterId}` }, { status: 400 });
    }

    console.log(`[Marketing] Generating video for ${characterId} with audio: ${audioSource}`);

    // 1. Get character portrait image
    const portraitFilename = PORTRAITS[characterId];
    const { blobs: imageBlobs } = await list({ prefix: `images/${portraitFilename}`, limit: 1 });

    let imageBuffer: Buffer;
    if (imageBlobs.length > 0) {
      const imageResult = await get(imageBlobs[0].url, { access: "private" });
      if (!imageResult?.stream) throw new Error("Could not read portrait image from blob");
      const chunks: Uint8Array[] = [];
      const reader = imageResult.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      imageBuffer = Buffer.concat(chunks);
    } else {
      // Fallback: fetch from public API
      const baseUrl = process.env.AUTH_URL || "https://www.koalatree.ai";
      const imgRes = await fetch(`${baseUrl}/api/images/${portraitFilename}`);
      if (!imgRes.ok) throw new Error(`Could not fetch portrait: ${imgRes.status}`);
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    console.log(`[Marketing] Portrait loaded: ${imageBuffer.byteLength} bytes`);

    // 2. Get audio
    let audioBuffer: Buffer;

    if (audioSource === "onboarding") {
      // Fetch onboarding audio
      const { blobs: audioBlobs } = await list({ prefix: "audio/onboarding-willkommen", limit: 5 });
      const audioBlob = audioBlobs.find((b) => b.pathname.endsWith(".mp3") || b.pathname.endsWith(".wav"));
      if (!audioBlob) throw new Error("Onboarding audio not found");
      const audioResult = await get(audioBlob.url, { access: "private" });
      if (!audioResult?.stream) throw new Error("Could not read onboarding audio");
      const audioChunks: Uint8Array[] = [];
      const audioReader = audioResult.stream.getReader();
      while (true) {
        const { done, value } = await audioReader.read();
        if (done) break;
        if (value) audioChunks.push(value);
      }
      audioBuffer = Buffer.concat(audioChunks);
    } else if (audioSource.startsWith("help-clip:")) {
      const clipId = audioSource.replace("help-clip:", "");
      const { blobs: clipBlobs } = await list({ prefix: `help-clips/${clipId}`, limit: 3 });
      const clipBlob = clipBlobs.find((b) => b.pathname.endsWith(".mp3"));
      if (!clipBlob) throw new Error(`Help clip not found: ${clipId}`);
      const clipResult = await get(clipBlob.url, { access: "private" });
      if (!clipResult?.stream) throw new Error("Could not read help clip");
      const clipChunks: Uint8Array[] = [];
      const clipReader = clipResult.stream.getReader();
      while (true) {
        const { done, value } = await clipReader.read();
        if (done) break;
        if (value) clipChunks.push(value);
      }
      audioBuffer = Buffer.concat(clipChunks);
    } else {
      throw new Error(`Unknown audio source: ${audioSource}`);
    }

    console.log(`[Marketing] Audio loaded: ${audioBuffer.byteLength} bytes`);

    // 3. Generate video via Hedra
    const prompt = PROMPTS[characterId] || PROMPTS.koda;
    const videoUrl = await generateVideo({
      imageBuffer,
      audioBuffer,
      prompt,
      aspectRatio,
      resolution,
    });

    // 4. Download video and store in Vercel Blob
    const videoBuffer = await downloadVideo(videoUrl);
    const videoName = `${characterId}-${audioSource.replace(":", "-")}`;

    const blob = await put(`marketing-videos/${videoName}.mp4`, videoBuffer, {
      contentType: "video/mp4",
      access: "private",
      allowOverwrite: true,
    });

    console.log(`[Marketing] Video stored: ${blob.url} (${videoBuffer.byteLength} bytes)`);

    return Response.json({
      success: true,
      characterId,
      audioSource,
      videoName,
      url: `/api/video/marketing/${videoName}`,
      size: videoBuffer.byteLength,
    });
  } catch (error) {
    console.error("[Marketing] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
