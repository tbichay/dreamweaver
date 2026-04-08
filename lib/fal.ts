/**
 * fal.ai API Integration — Kling LipSync + Kling 3.0 I2V
 *
 * Used for:
 * - Standard quality lip-sync ($0.014/s via Kling LipSync)
 * - Kling Avatar v2 Pro lip-sync ($0.115/s)
 * - Kling 3.0 Image-to-Video for landscape scenes
 */

const FAL_BASE = "https://fal.run";
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 600000; // 10 minutes

function getApiKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Key ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

// ── File Upload Helper ─────────────────────────────────────────────

async function uploadToFal(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  // fal.ai accepts URLs — upload to their storage first
  const uploadRes = await fetch("https://fal.run/fal-ai/storage/upload", {
    method: "POST",
    headers: {
      Authorization: `Key ${getApiKey()}`,
    },
    body: (() => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }), filename);
      return form;
    })(),
  });

  if (!uploadRes.ok) {
    throw new Error(`fal.ai upload error: ${uploadRes.status} — ${await uploadRes.text()}`);
  }

  const data = await uploadRes.json();
  return data.url;
}

// ── Queue Helper ───────────────────────────────────────────────────

async function submitAndPoll<T>(modelId: string, input: Record<string, unknown>): Promise<T> {
  // Submit to queue
  const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input }),
  });

  if (!submitRes.ok) {
    throw new Error(`fal.ai submit error: ${submitRes.status} — ${await submitRes.text()}`);
  }

  const { request_id } = await submitRes.json();
  console.log(`[fal.ai] Submitted ${modelId}: ${request_id}`);

  // Poll for result
  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT) {
    const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}/status`, {
      headers: headers(),
    });

    if (!statusRes.ok) throw new Error(`fal.ai status error: ${statusRes.status}`);
    const status = await statusRes.json();

    if (status.status === "COMPLETED") {
      // Fetch result
      const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}`, {
        headers: headers(),
      });
      if (!resultRes.ok) throw new Error(`fal.ai result error: ${resultRes.status}`);
      return await resultRes.json();
    }

    if (status.status === "FAILED") {
      throw new Error(`fal.ai generation failed: ${JSON.stringify(status)}`);
    }

    console.log(`[fal.ai] ${modelId}: ${status.status}...`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error(`fal.ai generation timed out after ${POLL_TIMEOUT / 1000}s`);
}

// ── Kling LipSync ($0.014/s) ───────────────────────────────────────

interface LipSyncResult {
  video: { url: string; content_type: string; file_size: number };
}

/**
 * Apply lip-sync to a video using Kling LipSync.
 * Takes an existing VIDEO + audio and syncs the mouth movements.
 * This is the cheapest lip-sync option at $0.014/s.
 */
export async function klingLipSync(
  videoBuffer: Buffer,
  audioBuffer: Buffer,
): Promise<string> {
  console.log("[fal.ai] Kling LipSync: uploading video + audio...");

  const videoUrl = await uploadToFal(videoBuffer, "scene.mp4", "video/mp4");
  const audioUrl = await uploadToFal(audioBuffer, "audio.mp3", "audio/mpeg");

  const result = await submitAndPoll<LipSyncResult>(
    "fal-ai/kling-video/lipsync/audio-to-video",
    { video_url: videoUrl, audio_url: audioUrl },
  );

  console.log(`[fal.ai] Kling LipSync done: ${result.video.url}`);
  return result.video.url;
}

// ── Kling Avatar v2 ($0.056-0.115/s) ──────────────────────────────

interface AvatarResult {
  video: { url: string };
}

/**
 * Generate a talking avatar video from a portrait image + audio.
 * Better quality than LipSync, as it generates the full video from scratch.
 */
export async function klingAvatar(
  imageBuffer: Buffer,
  audioBuffer: Buffer,
  prompt?: string,
  quality: "standard" | "pro" = "pro",
): Promise<string> {
  const modelId = quality === "pro"
    ? "fal-ai/kling-video/ai-avatar/v2/pro"
    : "fal-ai/kling-video/ai-avatar/v2/standard";

  console.log(`[fal.ai] Kling Avatar v2 ${quality}: uploading image + audio...`);

  const imageUrl = await uploadToFal(imageBuffer, "portrait.png", "image/png");
  const audioUrl = await uploadToFal(audioBuffer, "audio.mp3", "audio/mpeg");

  const input: Record<string, unknown> = {
    image_url: imageUrl,
    audio_url: audioUrl,
  };
  if (prompt) input.prompt = prompt;

  const result = await submitAndPoll<AvatarResult>(modelId, input);
  console.log(`[fal.ai] Kling Avatar v2 ${quality} done: ${result.video.url}`);
  return result.video.url;
}

// ── Kling 3.0 Image-to-Video ($0.17/s) ────────────────────────────

interface I2VResult {
  video: { url: string };
}

/**
 * Generate an animated video from a still image using Kling 3.0.
 * Used for landscape/transition scenes.
 */
export async function klingI2V(
  imageBuffer: Buffer,
  prompt: string,
  durationSeconds = 5,
  aspectRatio: "16:9" | "9:16" | "1:1" = "9:16",
): Promise<string> {
  console.log(`[fal.ai] Kling 3.0 I2V: uploading image...`);

  const imageUrl = await uploadToFal(imageBuffer, "scene.png", "image/png");

  const result = await submitAndPoll<I2VResult>(
    "fal-ai/kling-video/v3/standard/image-to-video",
    {
      image_url: imageUrl,
      prompt,
      duration: durationSeconds,
      aspect_ratio: aspectRatio,
    },
  );

  console.log(`[fal.ai] Kling 3.0 I2V done: ${result.video.url}`);
  return result.video.url;
}

// ── Download Helper ────────────────────────────────────────────────

export async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
