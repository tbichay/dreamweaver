import { auth } from "@/lib/auth";
import { generateVideo, downloadVideo } from "@/lib/hedra";
import { put, list, get } from "@vercel/blob";

export const maxDuration = 800; // 5 minutes

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

// Optimized prompts for Hedra Character-3 lip-sync quality:
// - Front-facing, clear facial features
// - Emotional tone matching the character
// - "speaking directly to camera" for best lip-sync
const PROMPTS: Record<string, string> = {
  koda: "Front-facing portrait of a wise koala character speaking directly to camera. Warm, gentle tone. Natural lip movements synchronized to speech. Kind eyes with subtle blinks. Slight head movements. Calm, fatherly demeanor. Warm lighting.",
  kiki: "Front-facing portrait of a playful kookaburra character speaking directly to camera. Enthusiastic, excited tone. Animated lip movements matching energetic speech. Bright expressive eyes, occasional playful head tilts. Cheerful, fun energy.",
  luna: "Front-facing portrait of a dreamy owl character speaking directly to camera. Soft, gentle tone. Graceful lip movements matching calm speech. Slow deliberate blinks, serene expression. Moonlit ambiance, mystical feeling.",
  mika: "Front-facing portrait of a brave dingo character speaking directly to camera. Confident, encouraging tone. Strong lip movements matching bold speech. Alert bright eyes, determined expression. Warm sunset lighting.",
  pip: "Front-facing portrait of a curious platypus character speaking directly to camera. Excited, bouncy tone. Quick animated lip movements matching enthusiastic speech. Wide curious eyes, eager expression. Bright cheerful lighting.",
  sage: "Front-facing portrait of a thoughtful wombat character speaking directly to camera. Slow, philosophical tone. Deliberate lip movements matching measured speech. Deep contemplative eyes, gentle wisdom. Soft earth-toned lighting.",
  nuki: "Front-facing portrait of a cheerful quokka character speaking directly to camera. Warm, joyful tone. Natural lip movements matching happy speech. Big bright smile, welcoming expression. Golden warm lighting.",
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
