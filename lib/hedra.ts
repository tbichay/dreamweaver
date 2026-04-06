/**
 * Hedra Character-3 API Integration
 * Generates talking-head videos from portrait images + audio.
 */

const BASE_URL = "https://api.hedra.com/web-app/public";
const POLL_INTERVAL = 5000; // 5 seconds
const POLL_TIMEOUT = 600000; // 10 minutes

function getApiKey(): string {
  const key = process.env.HEDRA_API_KEY;
  if (!key) throw new Error("HEDRA_API_KEY is not set");
  return key;
}

function headers(contentType = true): Record<string, string> {
  const h: Record<string, string> = { "x-api-key": getApiKey() };
  if (contentType) h["Content-Type"] = "application/json";
  return h;
}

// --- Get available model ---

async function getModelId(): Promise<string> {
  const res = await fetch(`${BASE_URL}/models`, { headers: headers() });
  if (!res.ok) throw new Error(`Hedra models error: ${res.status} — ${await res.text()}`);
  const models = await res.json() as Array<{ id: string; name: string; type: string; requires_audio_input: boolean }>;
  if (!models?.length) throw new Error("No Hedra models available");

  // Find Hedra Character 3 (talking head with audio) — the best model for lip-sync
  const character3 = models.find((m) => m.name.includes("Character 3") && m.requires_audio_input);
  if (character3) return character3.id;

  // Fallback: any video model that requires audio
  const audioModel = models.find((m) => m.type === "video" && m.requires_audio_input);
  if (audioModel) return audioModel.id;

  throw new Error("No suitable Hedra video model found (need audio-capable model)");
}

// --- Asset upload ---

async function createAsset(name: string, type: "image" | "audio"): Promise<string> {
  const res = await fetch(`${BASE_URL}/assets`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, type }),
  });
  if (!res.ok) throw new Error(`Hedra asset creation error: ${res.status} — ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function uploadAsset(assetId: string, file: Buffer, filename: string, mimeType: string): Promise<void> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(file)], { type: mimeType });
  formData.append("file", blob, filename);

  const res = await fetch(`${BASE_URL}/assets/${assetId}/upload`, {
    method: "POST",
    headers: { "x-api-key": getApiKey() },
    body: formData,
  });
  if (!res.ok) throw new Error(`Hedra upload error: ${res.status} — ${await res.text()}`);
}

// --- Video generation ---

interface GenerateVideoOptions {
  imageBuffer: Buffer;
  audioBuffer: Buffer;
  prompt?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  resolution?: "540p" | "720p";
}

interface GenerationStatus {
  status: string;
  url?: string;
  error_message?: string;
}

export async function generateVideo(options: GenerateVideoOptions): Promise<string> {
  const {
    imageBuffer,
    audioBuffer,
    prompt = "A warm, friendly animated character speaking naturally with gentle expressions",
    aspectRatio = "9:16",
    resolution = "720p",
  } = options;

  console.log("[Hedra] Starting video generation...");

  // 1. Get model
  const modelId = await getModelId();
  console.log(`[Hedra] Model: ${modelId}`);

  // 2. Upload image
  const imageAssetId = await createAsset("portrait.png", "image");
  await uploadAsset(imageAssetId, imageBuffer, "portrait.png", "image/png");
  console.log(`[Hedra] Image uploaded: ${imageAssetId}`);

  // 3. Upload audio
  const audioAssetId = await createAsset("audio.mp3", "audio");
  await uploadAsset(audioAssetId, audioBuffer, "audio.mp3", "audio/mpeg");
  console.log(`[Hedra] Audio uploaded: ${audioAssetId}`);

  // 4. Create generation
  const genRes = await fetch(`${BASE_URL}/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "video",
      ai_model_id: modelId,
      start_keyframe_id: imageAssetId,
      audio_id: audioAssetId,
      generated_video_inputs: {
        text_prompt: prompt,
        resolution,
        aspect_ratio: aspectRatio,
      },
    }),
  });

  if (!genRes.ok) throw new Error(`Hedra generation error: ${genRes.status} — ${await genRes.text()}`);
  const genData = await genRes.json();
  const generationId = genData.id;
  console.log(`[Hedra] Generation started: ${generationId}`);

  // 5. Poll for completion
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT) {
    const statusRes = await fetch(`${BASE_URL}/generations/${generationId}/status`, {
      headers: headers(),
    });

    if (!statusRes.ok) throw new Error(`Hedra status error: ${statusRes.status}`);
    const statusData: GenerationStatus = await statusRes.json();

    console.log(`[Hedra] Status: ${statusData.status}`);

    if (statusData.status === "complete" && statusData.url) {
      console.log(`[Hedra] Video ready!`);
      return statusData.url;
    }

    if (statusData.status === "error") {
      throw new Error(`Hedra generation failed: ${statusData.error_message || "Unknown error"}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error("Hedra generation timed out after 10 minutes");
}

/**
 * Download a video from URL and return as Buffer
 */
export async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
