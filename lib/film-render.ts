/**
 * KoalaTree Film Renderer — Remotion-based video mastering
 *
 * Assembles individual scene clips into a finished film with:
 * - Crossfade transitions
 * - Continuous story audio
 * - Background music layer
 * - Title/outro cards
 *
 * Uses Remotion's renderMedia() for server-side rendering.
 */

// Dynamic imports for Remotion — these have Node.js-only deps
// that can't be bundled by Next.js/Webpack
import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";
import os from "os";
import type { FilmProps, FilmScene } from "../remotion/FilmComposition";

const FPS = 30;

interface RenderFilmOptions {
  geschichteId: string;
  scenes: Array<{
    videoUrl: string; // Proxy URL like /api/video/film-scene/{id}/{idx}
    durationMs: number;
    type: string;
    characterId?: string;
  }>;
  storyAudioUrl?: string; // Proxy URL like /api/audio/{id}
  backgroundMusicUrl?: string;
  title?: string;
  subtitle?: string;
  musicVolume?: number;
  format?: "portrait" | "wide";
}

/**
 * Render a complete film from individual scene clips.
 * Downloads all clips, bundles Remotion, renders, and uploads result.
 *
 * Returns the Vercel Blob URL of the finished film.
 */
export async function renderFilm(options: RenderFilmOptions): Promise<string> {
  const {
    geschichteId,
    scenes,
    storyAudioUrl,
    backgroundMusicUrl,
    title = "KoalaTree",
    subtitle = "praesentiert",
    musicVolume = 0.08,
    format = "portrait",
  } = options;

  console.log(`[Render] Starting film render for ${geschichteId} (${scenes.length} scenes)...`);

  // 1. Create temp directory for downloaded clips
  const tmpDir = path.join(os.tmpdir(), `koalatree-render-${geschichteId}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 2. Download all scene clips to temp files
    const baseUrl = process.env.AUTH_URL || "https://www.koalatree.ai";
    const downloadedScenes: FilmScene[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const clipPath = path.join(tmpDir, `scene-${i}.mp4`);

      // Download clip
      const url = scene.videoUrl.startsWith("http")
        ? scene.videoUrl
        : `${baseUrl}${scene.videoUrl}`;

      console.log(`[Render] Downloading scene ${i}...`);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[Render] Scene ${i} download failed (${res.status}), skipping`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(clipPath, buffer);

      downloadedScenes.push({
        videoUrl: clipPath, // Local file path
        durationFrames: Math.ceil((scene.durationMs / 1000) * FPS),
        type: scene.type as FilmScene["type"],
        characterId: scene.characterId,
      });
    }

    if (downloadedScenes.length === 0) {
      throw new Error("No scenes to render");
    }

    // 3. Download story audio if available
    let localAudioPath: string | undefined;
    if (storyAudioUrl) {
      const audioUrl = storyAudioUrl.startsWith("http")
        ? storyAudioUrl
        : `${baseUrl}${storyAudioUrl}`;
      const audioRes = await fetch(audioUrl);
      if (audioRes.ok) {
        localAudioPath = path.join(tmpDir, "story-audio.mp3");
        fs.writeFileSync(localAudioPath, Buffer.from(await audioRes.arrayBuffer()));
        console.log(`[Render] Story audio downloaded`);
      }
    }

    // 4. Calculate total duration
    const crossfadeDurationFrames = 8;
    let totalFrames = title ? 3 * FPS : 0; // Title card
    for (let i = 0; i < downloadedScenes.length; i++) {
      totalFrames += downloadedScenes[i].durationFrames;
      if (i < downloadedScenes.length - 1) {
        totalFrames -= crossfadeDurationFrames; // Crossfade overlap
      }
    }

    console.log(`[Render] Total: ${downloadedScenes.length} scenes, ${(totalFrames / FPS).toFixed(1)}s, ${totalFrames} frames`);

    // 5. Dynamic import Remotion (Node.js-only deps)
    const { bundle } = await import("@remotion/bundler");
    const { renderMedia, selectComposition } = await import("@remotion/renderer");

    // 6. Bundle Remotion project
    const entryPoint = path.resolve(process.cwd(), "remotion/index.ts");
    console.log(`[Render] Bundling Remotion...`);
    const bundled = await bundle({
      entryPoint,
      publicDir: path.resolve(process.cwd(), "public"),
    });

    // 7. Select composition
    const compositionId = format === "wide" ? "KoalaTreeFilmWide" : "KoalaTreeFilm";
    const inputProps: FilmProps = {
      scenes: downloadedScenes,
      storyAudioUrl: localAudioPath,
      backgroundMusicUrl,
      musicVolume,
      crossfadeDurationFrames,
      title,
      subtitle,
    };

    const composition = await selectComposition({
      serveUrl: bundled,
      id: compositionId,
      inputProps,
    });

    // Override duration with calculated total
    composition.durationInFrames = totalFrames;

    // 8. Render video
    const outputPath = path.join(tmpDir, "film-final.mp4");
    console.log(`[Render] Rendering ${compositionId}...`);

    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
    });

    console.log(`[Render] Render complete!`);

    // 8. Upload to Vercel Blob
    const finalBuffer = fs.readFileSync(outputPath);
    const blob = await put(
      `films/${geschichteId}/final.mp4`,
      finalBuffer,
      { access: "private", contentType: "video/mp4", allowOverwrite: true },
    );

    console.log(`[Render] Uploaded: ${(finalBuffer.byteLength / 1024 / 1024).toFixed(1)}MB → ${blob.url}`);

    return blob.url;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* cleanup optional */ }
  }
}
