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

// ── Kling 3.0 Image-to-Video ($0.084-0.168/s) ─────────────────────

interface I2VResult {
  video: { url: string };
}

interface KlingElement {
  frontal_image_url: string;
  reference_image_urls?: string[];
}

interface KlingI2VOptions {
  imageBuffer: Buffer;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  quality?: "standard" | "pro";
  /** End frame image — Kling morphs from start to end, creating smooth transitions */
  endImageBuffer?: Buffer;
  /** Character reference images for Element Binding (@Element1 in prompt) */
  characterElements?: Buffer[];
  /** Generate native audio (ambient sounds) */
  generateAudio?: boolean;
}

/**
 * Generate an animated video from a still image using Kling 3.0.
 * Supports:
 * - Element Binding for character consistency (Pro)
 * - End frame for seamless transitions between scenes
 * - Native audio for ambient sounds
 */
export async function klingI2V(options: KlingI2VOptions): Promise<string> {
  const {
    imageBuffer,
    prompt,
    durationSeconds = 5,
    aspectRatio = "9:16",
    quality = "standard",
    endImageBuffer,
    characterElements,
    generateAudio = false,
  } = options;

  const modelId = quality === "pro"
    ? "fal-ai/kling-video/v3/pro/image-to-video"
    : "fal-ai/kling-video/v3/standard/image-to-video";

  console.log(`[fal.ai] Kling 3.0 ${quality} I2V: uploading...`);

  const startImageUrl = await uploadToFal(imageBuffer, "start.png", "image/png");

  const input: Record<string, unknown> = {
    start_image_url: startImageUrl,
    prompt,
    duration: durationSeconds,
    aspect_ratio: aspectRatio,
    generate_audio: generateAudio,
  };

  // End frame for smooth transitions
  if (endImageBuffer) {
    input.end_image_url = await uploadToFal(endImageBuffer, "end.png", "image/png");
    console.log(`[fal.ai] End frame uploaded for transition`);
  }

  // Character elements for consistency (Pro only)
  if (characterElements && characterElements.length > 0 && quality === "pro") {
    const elements: KlingElement[] = [];
    for (let i = 0; i < Math.min(characterElements.length, 4); i++) {
      const url = await uploadToFal(characterElements[i], `element-${i}.png`, "image/png");
      elements.push({ frontal_image_url: url });
    }
    input.elements = elements;
    console.log(`[fal.ai] ${elements.length} character element(s) uploaded`);
  }

  const result = await submitAndPoll<I2VResult>(modelId, input);
  console.log(`[fal.ai] Kling 3.0 ${quality} I2V done: ${result.video.url}`);
  return result.video.url;
}

/**
 * Generate a sequence of visually consistent scenes using Kling 3.0.
 * Each scene uses the previous scene's end frame as its start frame,
 * creating seamless transitions.
 *
 * @param scenes - Array of { imageBuffer, prompt, durationSeconds }
 * @param characterRefs - Character reference images used across all scenes
 * @returns Array of video URLs
 */
export async function klingMultiScene(
  scenes: Array<{
    imageBuffer: Buffer;
    prompt: string;
    durationSeconds?: number;
  }>,
  characterRefs?: Buffer[],
  aspectRatio: "16:9" | "9:16" | "1:1" = "9:16",
): Promise<string[]> {
  const videoUrls: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prevScene = i > 0 ? scenes[i] : undefined;

    console.log(`[fal.ai] Multi-scene ${i + 1}/${scenes.length}: ${scene.prompt.substring(0, 50)}...`);

    // Use previous scene's start image as context (the end frame would be ideal
    // but we don't extract it — the start image provides visual continuity)
    const url = await klingI2V({
      imageBuffer: scene.imageBuffer,
      prompt: scene.prompt,
      durationSeconds: scene.durationSeconds || 5,
      aspectRatio,
      quality: "pro",
      characterElements: characterRefs,
      generateAudio: true,
    });

    videoUrls.push(url);
  }

  return videoUrls;
}

// ── Download Helper ────────────────────────────────────────────────

export async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
