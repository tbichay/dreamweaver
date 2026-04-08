#!/usr/bin/env node
/**
 * KoalaTree Film Renderer — Local Remotion render script
 *
 * Usage: node scripts/render-film.mjs <geschichteId> [portrait|wide]
 *
 * Downloads all clips, runs Remotion render, uploads result to Vercel Blob.
 * Requires: ffmpeg, Chromium (installed by Remotion automatically)
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { put, list, get } from "@vercel/blob";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FPS = 30;

const geschichteId = process.argv[2];
const format = process.argv[3] || "portrait";

if (!geschichteId) {
  console.error("Usage: node scripts/render-film.mjs <geschichteId> [portrait|wide]");
  process.exit(1);
}

// Load env
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const [key, ...vals] = line.split("=");
    if (key && !key.startsWith("#")) process.env[key.trim()] = vals.join("=").trim();
  }
}

const BASE_URL = process.env.AUTH_URL || "http://localhost:3000";

async function main() {
  console.log(`\n🎬 KoalaTree Film Renderer`);
  console.log(`   Story: ${geschichteId}`);
  console.log(`   Format: ${format}`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  // 1. Load scene clips from Blob
  const { blobs } = await list({ prefix: `films/${geschichteId}/scene-`, limit: 100 });
  const clips = blobs
    .filter((b) => b.pathname.endsWith(".mp4"))
    .map((b) => {
      const match = b.pathname.match(/scene-(\d+)\.mp4$/);
      return { index: match ? parseInt(match[1]) : -1, blob: b };
    })
    .filter((c) => c.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (clips.length < 2) {
    console.error("❌ Mindestens 2 Clips noetig. Generiere zuerst Clips im Film-Editor.");
    process.exit(1);
  }

  console.log(`📁 ${clips.length} Clips gefunden\n`);

  // 2. Create temp directory and download clips
  const tmpDir = path.join(os.tmpdir(), `koalatree-render-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const scenes = [];
  for (const clip of clips) {
    const localPath = path.join(tmpDir, `scene-${clip.index}.mp4`);
    console.log(`   ⬇ Downloading scene-${clip.index}.mp4 (${(clip.blob.size / 1024).toFixed(0)}KB)...`);

    const result = await get(clip.blob.url, { access: "private" });
    if (!result?.stream) { console.warn(`   ⚠ Skipping scene ${clip.index}`); continue; }

    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    fs.writeFileSync(localPath, Buffer.concat(chunks));

    // Estimate 5s per clip (we don't have exact duration without ffprobe)
    scenes.push({
      videoUrl: localPath,
      durationFrames: 5 * FPS, // Will be adjusted by Remotion
      type: "dialog",
      characterId: undefined,
    });
  }

  // 3. Download story audio
  let storyAudioPath;
  try {
    const audioRes = await fetch(`${BASE_URL}/api/audio/${geschichteId}`);
    if (audioRes.ok) {
      storyAudioPath = path.join(tmpDir, "audio.mp3");
      fs.writeFileSync(storyAudioPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`   ⬇ Story audio downloaded\n`);
    }
  } catch { console.log("   ⚠ Story audio not available\n"); }

  // 4. Bundle Remotion
  console.log("📦 Bundling Remotion...");
  const entryPoint = path.join(ROOT, "remotion/index.ts");
  const bundled = await bundle({ entryPoint, publicDir: path.join(ROOT, "public") });

  // 5. Select composition
  const compositionId = format === "wide" ? "KoalaTreeFilmWide" : "KoalaTreeFilm";
  const crossfade = 8;
  let totalFrames = 3 * FPS; // Title card
  for (let i = 0; i < scenes.length; i++) {
    totalFrames += scenes[i].durationFrames;
    if (i < scenes.length - 1) totalFrames -= crossfade;
  }

  const inputProps = {
    scenes,
    storyAudioUrl: storyAudioPath,
    title: "KoalaTree",
    subtitle: "praesentiert",
    musicVolume: 0.08,
    crossfadeDurationFrames: crossfade,
  };

  const composition = await selectComposition({ serveUrl: bundled, id: compositionId, inputProps });
  composition.durationInFrames = totalFrames;

  // 6. Render
  const outputPath = path.join(tmpDir, "film-final.mp4");
  console.log(`\n🎥 Rendering ${compositionId} (${(totalFrames / FPS).toFixed(1)}s, ${scenes.length} scenes)...\n`);

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${(progress * 100).toFixed(1)}%`);
    },
  });

  console.log("\n");

  // 7. Upload to Blob
  const finalBuffer = fs.readFileSync(outputPath);
  console.log(`📤 Uploading film (${(finalBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)...`);

  const blob = await put(
    `films/${geschichteId}/final.mp4`,
    finalBuffer,
    { access: "private", contentType: "video/mp4", allowOverwrite: true },
  );

  console.log(`\n✅ Film fertig!`);
  console.log(`   Blob: ${blob.url}`);
  console.log(`   Groesse: ${(finalBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Szenen: ${scenes.length}`);
  console.log(`   Dauer: ${(totalFrames / FPS).toFixed(1)}s\n`);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
