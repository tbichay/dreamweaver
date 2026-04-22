#!/usr/bin/env node
/**
 * KoalaTree Film Mastering Script
 *
 * Takes generated scene clips and assembles them into a final film with:
 * - Intro title card
 * - Normalized audio
 * - Color grading (warm palette)
 * - Crossfade transitions
 * - Background music
 * - Outro card
 *
 * Usage: node scripts/master-film.mjs <geschichteId>
 * Requires: ffmpeg installed locally
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

const geschichteId = process.argv[2];
const introClipUrl = process.argv[3] || null;
const outroClipUrl = process.argv[4] || null;
if (!geschichteId) {
  console.error("Usage: node scripts/master-film.mjs <geschichteId> [introClipUrl] [outroClipUrl]");
  process.exit(1);
}

const CLIPS_DIR = join(process.cwd(), `tmp/films/${geschichteId}`);
const MASTER_DIR = join(process.cwd(), `tmp/films/${geschichteId}/master`);
const FINAL_OUTPUT = join(MASTER_DIR, "koalatree-film-final.mp4");

async function main() {
  console.log("🎬 KoalaTree Film Mastering\n");

  mkdirSync(MASTER_DIR, { recursive: true });

  // 1. Find all scene clips
  if (!existsSync(CLIPS_DIR)) {
    console.error(`❌ Clips directory not found: ${CLIPS_DIR}`);
    console.error("   Run the film generation first, then download clips.");
    process.exit(1);
  }

  const clips = readdirSync(CLIPS_DIR)
    .filter(f => f.startsWith("scene-") && f.endsWith(".mp4"))
    .sort();

  if (clips.length === 0) {
    console.error("❌ No scene clips found");
    process.exit(1);
  }

  console.log(`📂 Found ${clips.length} scene clips\n`);

  // 2. Prepare Intro (download from blob or create fallback)
  console.log("🎬 Preparing intro...");
  const introPath = join(MASTER_DIR, "intro.mp4");
  if (introClipUrl) {
    try {
      const res = await fetch(introClipUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(introPath, buf);
        console.log(`  ✓ Intro downloaded (${(buf.length / 1024).toFixed(0)}KB)`);
      }
    } catch { console.log("  ⚠ Intro download failed"); }
  }
  if (!existsSync(introPath)) {
    try {
      execSync(
        `ffmpeg -y -f lavfi -i "color=c=0x1a2e1a:s=720x1280:d=3:r=30" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 3 -vf "drawtext=text='KoalaTree':fontsize=64:fontcolor=0xf5eed6:x=(w-text_w)/2:y=(h-text_h)/2-40,drawtext=text='präsentiert':fontsize=28:fontcolor=0xa8d5b8:x=(w-text_w)/2:y=(h-text_h)/2+40" -c:v libx264 -preset fast -crf 18 -c:a aac -shortest "${introPath}"`,
        { stdio: "pipe" }
      );
      console.log("  ✓ Intro card (3s fallback)");
    } catch { console.log("  ⚠ Intro creation failed, skipping"); }
  }

  // 3. Prepare Outro
  console.log("🎬 Preparing outro...");
  const outroPath = join(MASTER_DIR, "outro.mp4");
  if (outroClipUrl) {
    try {
      const res = await fetch(outroClipUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(outroPath, buf);
        console.log(`  ✓ Outro downloaded (${(buf.length / 1024).toFixed(0)}KB)`);
      }
    } catch { console.log("  ⚠ Outro download failed"); }
  }
  if (!existsSync(outroPath)) {
    try {
      execSync(
        `ffmpeg -y -f lavfi -i "color=c=0x1a2e1a:s=720x1280:d=4:r=30" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 4 -vf "drawtext=text='Erstellt mit':fontsize=24:fontcolor=0xa8d5b880:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=text='KoalaTree':fontsize=48:fontcolor=0xf5eed6:x=(w-text_w)/2:y=(h-text_h)/2+20" -c:v libx264 -preset fast -crf 18 -c:a aac -shortest "${outroPath}"`,
        { stdio: "pipe" }
      );
      console.log("  ✓ Outro card (4s fallback)");
    } catch { console.log("  ⚠ Outro creation failed, skipping"); }
  }

  // 4. Normalize and color-grade each clip
  console.log("\n🎨 Processing clips...");
  const processedClips = [];

  // Add intro if it exists
  if (existsSync(introPath)) processedClips.push(introPath);

  for (let i = 0; i < clips.length; i++) {
    const input = join(CLIPS_DIR, clips[i]);
    const normalized = join(MASTER_DIR, `norm-${clips[i]}`);

    console.log(`  ${i + 1}/${clips.length}: ${clips[i]}`);

    try {
      // Normalize audio + warm color grade in one pass
      execSync(
        `ffmpeg -y -i "${input}" -vf "colortemperature=6800,eq=brightness=0.02:saturation=1.1" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k "${normalized}"`,
        { stdio: "pipe" }
      );
      processedClips.push(normalized);
      console.log("    ✓ Normalized + color graded");
    } catch {
      // If processing fails, use original
      processedClips.push(input);
      console.log("    ⚠ Using original (processing failed)");
    }
  }

  // Add outro if it exists
  if (existsSync(outroPath)) processedClips.push(outroPath);

  // 5. Create concat list
  console.log(`\n🔗 Concatenating ${processedClips.length} clips...`);
  const concatList = join(MASTER_DIR, "concat.txt");
  const concatContent = processedClips.map(f => `file '${f}'`).join("\n");
  writeFileSync(concatList, concatContent);

  // First: re-encode all to same format for concat compatibility
  const reencoded = [];
  for (let i = 0; i < processedClips.length; i++) {
    const re = join(MASTER_DIR, `re-${String(i).padStart(3, "0")}.mp4`);
    try {
      execSync(
        `ffmpeg -y -i "${processedClips[i]}" -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" -c:v libx264 -preset fast -crf 23 -c:a aac -ar 44100 -ac 2 -b:a 128k -shortest "${re}"`,
        { stdio: "pipe" }
      );
      reencoded.push(re);
    } catch {
      console.log(`  ⚠ Re-encode failed for clip ${i}, skipping`);
    }
  }

  // Write new concat list
  const concatList2 = join(MASTER_DIR, "concat2.txt");
  writeFileSync(concatList2, reencoded.map(f => `file '${f}'`).join("\n"));

  // Concat
  const concatOutput = join(MASTER_DIR, "concat-raw.mp4");
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatList2}" -c copy "${concatOutput}"`,
    { stdio: "pipe" }
  );
  console.log("  ✓ Concatenated");

  // 6. Add background music (soft ambient tone)
  console.log("\n🎵 Adding background ambience...");
  const musicPath = join(MASTER_DIR, "ambient.mp3");
  if (!existsSync(musicPath)) {
    execSync(
      `ffmpeg -y -f lavfi -i "sine=frequency=174:duration=600" -af "volume=0.02,afade=t=in:d=3" -c:a libmp3lame -q:a 9 "${musicPath}"`,
      { stdio: "pipe" }
    );
  }

  // Get video duration for music fade-out
  const durStr = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${concatOutput}"`, { encoding: "utf8" }).trim();
  const totalDur = parseFloat(durStr);
  const fadeOut = Math.max(0, totalDur - 3);

  try {
    execSync(
      `ffmpeg -y -i "${concatOutput}" -i "${musicPath}" -filter_complex "[1:a]afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3,volume=0.06[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${FINAL_OUTPUT}"`,
      { stdio: "pipe" }
    );
    console.log("  ✓ Background music added");
  } catch {
    // If music mixing fails, just use the concat output
    execSync(`cp "${concatOutput}" "${FINAL_OUTPUT}"`);
    console.log("  ⚠ Music mixing failed, using without music");
  }

  // 7. Summary
  const finalSize = readFileSync(FINAL_OUTPUT).length;
  console.log(`\n✅ Film mastered!`);
  console.log(`   Output: ${FINAL_OUTPUT}`);
  console.log(`   Size: ${(finalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Duration: ${totalDur.toFixed(1)}s (${Math.floor(totalDur / 60)}:${String(Math.floor(totalDur % 60)).padStart(2, "0")})`);
  console.log(`   Clips: ${clips.length} scenes + intro + outro`);

  // Cleanup temp files
  reencoded.forEach(f => { try { unlinkSync(f); } catch {} });

  console.log(`\n🎉 Opening...`);
  execSync(`open "${FINAL_OUTPUT}"`);
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
