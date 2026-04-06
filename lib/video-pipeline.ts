/**
 * KoalaTree Video Pipeline
 *
 * Orchestrates the full Story → Film generation:
 * 1. AI Director analyzes story → scene list
 * 2. Per scene: Hedra lip-sync OR Kling scene animation
 * 3. Download all clips
 * 4. Upload assembled film to Vercel Blob
 *
 * Note: ffmpeg concat runs on the server. On Vercel, the individual clips
 * are stored and a simple concat is done via fetch + buffer manipulation.
 * For full transitions/music, use the local script (scripts/create-trailer.mjs).
 */

import { prisma } from "./db";
import { analyzeStoryForFilm, type FilmScene, type TimelineEntry } from "./video-director";
import { generateVideo, generateSceneVideo, downloadVideo } from "./hedra";
import { put, get, list } from "@vercel/blob";

// --- Types ---

export interface FilmGenerationResult {
  videoUrl: string;
  scenes: FilmScene[];
  totalDurationSek: number;
}

// --- Portrait loader ---

async function loadPortraitBuffer(characterId: string): Promise<Buffer> {
  const filename = `${characterId}-portrait.png`;

  // Try blob store first
  const { blobs } = await list({ prefix: `images/${filename}`, limit: 1 });
  if (blobs.length > 0) {
    const result = await get(blobs[0].url, { access: "private" });
    if (result?.stream) {
      const chunks: Uint8Array[] = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return Buffer.concat(chunks);
    }
  }

  // Fallback: fetch from app
  const baseUrl = process.env.AUTH_URL || "https://www.koalatree.ai";
  const res = await fetch(`${baseUrl}/api/images/${filename}`);
  if (!res.ok) throw new Error(`Portrait not found: ${characterId}`);
  return Buffer.from(await res.arrayBuffer());
}

// --- Audio segment extraction ---

async function loadAudioBuffer(geschichteId: string): Promise<Buffer> {
  const geschichte = await prisma.geschichte.findUnique({
    where: { id: geschichteId },
    select: { audioUrl: true },
  });

  if (!geschichte?.audioUrl) throw new Error("No audio URL found");

  const result = await get(geschichte.audioUrl, { access: "private" });
  if (!result?.stream) throw new Error("Could not load audio");

  const chunks: Uint8Array[] = [];
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// --- Main Pipeline ---

export async function generateFilm(geschichteId: string): Promise<FilmGenerationResult> {
  console.log(`[Film] Starting film generation for story ${geschichteId}`);

  // 1. Load story data
  const geschichte = await prisma.geschichte.findUnique({
    where: { id: geschichteId },
    select: {
      id: true,
      text: true,
      titel: true,
      audioUrl: true,
      audioDauerSek: true,
      timeline: true,
    },
  });

  if (!geschichte) throw new Error("Story not found");
  if (!geschichte.text) throw new Error("Story has no text");
  if (!geschichte.audioUrl) throw new Error("Story has no audio — generate audio first");

  const timeline = (geschichte.timeline as unknown as TimelineEntry[]) || [];

  // 2. AI Director — analyze story and create scene list
  console.log("[Film] Running AI Director...");
  const scenes = await analyzeStoryForFilm(geschichte.text, timeline);
  console.log(`[Film] Director created ${scenes.length} scenes`);

  // 3. Load full audio
  const fullAudioBuffer = await loadAudioBuffer(geschichteId);
  console.log(`[Film] Audio loaded: ${fullAudioBuffer.byteLength} bytes`);

  // 4. Generate video clips for each scene (sequentially to respect rate limits)
  const clips: { scene: FilmScene; videoBuffer: Buffer }[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(`[Film] Generating scene ${i + 1}/${scenes.length}: ${scene.type} — ${scene.sceneDescription.substring(0, 50)}...`);

    try {
      let videoUrl: string;

      if (scene.type === "dialog" && scene.characterId) {
        // Lip-sync: Hedra Character-3 (portrait + audio segment)
        const portraitBuffer = await loadPortraitBuffer(scene.characterId);

        // For dialog scenes, we pass the full audio and let Hedra handle it
        // (Hedra Character-3 works best with the actual speech audio)
        // In a production pipeline, we'd slice the audio segment here
        videoUrl = await generateVideo({
          imageBuffer: portraitBuffer,
          audioBuffer: fullAudioBuffer, // TODO: slice to scene.audioStartMs-audioEndMs
          prompt: scene.sceneDescription,
          aspectRatio: "9:16",
          resolution: "720p",
        });
      } else {
        // Landscape/Transition: Kling scene animation
        // Use a KoalaTree landscape illustration as base
        // For now, use Koda's portrait as placeholder (replace with scene illustrations later)
        const sceneImageBuffer = await loadPortraitBuffer("koda");

        videoUrl = await generateSceneVideo({
          imageBuffer: sceneImageBuffer,
          prompt: `${scene.sceneDescription}. ${scene.mood}. Camera: ${scene.camera}. KoalaTree animated style, warm colors, magical forest atmosphere.`,
          aspectRatio: "9:16",
          resolution: "720p",
        });
      }

      const videoBuffer = await downloadVideo(videoUrl);
      clips.push({ scene, videoBuffer });
      console.log(`[Film] Scene ${i + 1} done: ${videoBuffer.byteLength} bytes`);
    } catch (err) {
      console.error(`[Film] Scene ${i + 1} failed:`, err);
      // Continue with remaining scenes — don't fail entire film for one scene
    }
  }

  if (clips.length === 0) {
    throw new Error("No scenes could be generated");
  }

  // 5. For now, upload individual clips and the first clip as the "film"
  // Full concat requires ffmpeg (local script) or a cloud video editor
  // TODO: Replace with proper concat when ffmpeg/Remotion is available

  // Upload each clip
  const clipUrls: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const blob = await put(
      `films/${geschichteId}/scene-${i}.mp4`,
      clips[i].videoBuffer,
      { access: "private", contentType: "video/mp4", allowOverwrite: true }
    );
    clipUrls.push(blob.url);
  }

  // Upload the "film" as the first clip for now
  // (proper concat happens via local ffmpeg script or cloud service)
  const filmBlob = await put(
    `films/${geschichteId}/film.mp4`,
    clips[0].videoBuffer, // Placeholder — first scene only
    { access: "private", contentType: "video/mp4", allowOverwrite: true }
  );

  console.log(`[Film] Uploaded ${clips.length} scenes + film placeholder`);

  const totalDuration = scenes.reduce((sum, s) => sum + s.durationHint, 0);

  return {
    videoUrl: filmBlob.url,
    scenes,
    totalDurationSek: totalDuration,
  };
}
