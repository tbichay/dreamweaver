/**
 * LipSync Pipeline Comparison Spike
 *
 * Runs the SAME dialog scene through 4 different lip-sync pipelines
 * and saves all outputs side-by-side in Blob so the user can compare.
 *
 * Variants:
 *   A — Kling O3 + Kling LipSync         (current baseline — chunk flicker)
 *   B — Kling O3 + Sync Labs sync-3      (post-proc upgrade, global context)
 *   C — OmniHuman 1.5                    (portrait + audio → talking head, Camp B)
 *   D — Seedance 2.0 Reference-to-Video  (one-call multimodal, 9 refs + audio)
 *
 * POST /api/studio/test-lipsync-spike
 * Body: {
 *   projectId: string,
 *   sequenceId: string,
 *   sceneIndex: number,
 *   variants?: Array<"A" | "B" | "C" | "D">   // default: all
 * }
 *
 * Returns: { results: { A: {...}, B: {...}, ... } }
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { put, get } from "@vercel/blob";
import type { StudioScene } from "@/lib/studio/types";

export const maxDuration = 800;

type Variant = "A" | "B" | "C" | "D";

interface VariantResult {
  label: string;
  provider: string;
  url?: string;
  cost?: number;
  durationMs: number;
  error?: string;
}

async function loadBlobBuffer(url: string): Promise<Buffer | undefined> {
  try {
    if (url.includes(".blob.vercel-storage.com")) {
      const blob = await get(url, { access: "private" });
      if (!blob?.stream) return undefined;
      const reader = blob.stream.getReader();
      const chunks: Uint8Array[] = [];
      let chunk;
      while (!(chunk = await reader.read()).done) chunks.push(chunk.value);
      return Buffer.concat(chunks);
    }
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json() as {
    projectId: string;
    sequenceId: string;
    sceneIndex: number;
    variants?: Variant[];
  };

  const { projectId, sequenceId, sceneIndex } = body;
  const variants: Variant[] = body.variants || ["A", "B", "C", "D"];

  if (!projectId || !sequenceId || typeof sceneIndex !== "number") {
    return Response.json({
      error: "projectId, sequenceId, sceneIndex erforderlich",
    }, { status: 400 });
  }

  // ── Load sequence + scene + character ──
  const sequence = await prisma.studioSequence.findFirst({
    where: { id: sequenceId, project: { id: projectId, userId } },
    include: {
      project: {
        include: { characters: { include: { actor: true } } },
      },
    },
  });
  if (!sequence) {
    return Response.json({ error: "Sequenz nicht gefunden" }, { status: 404 });
  }

  const scenes = (sequence.scenes as unknown as StudioScene[]) || [];
  const scene = scenes[sceneIndex];
  if (!scene) {
    return Response.json({ error: `Szene ${sceneIndex} nicht gefunden` }, { status: 404 });
  }
  if (scene.type !== "dialog") {
    return Response.json({ error: "Test nur fuer Dialog-Szenen sinnvoll" }, { status: 400 });
  }
  if (!scene.dialogAudioUrl) {
    return Response.json({
      error: "Szene hat keine dialogAudioUrl — Dialog-Audio zuerst generieren",
    }, { status: 400 });
  }
  if (!scene.characterId) {
    return Response.json({ error: "Szene hat keinen characterId" }, { status: 400 });
  }

  const character = sequence.project.characters.find((c) => c.id === scene.characterId);
  if (!character) {
    return Response.json({ error: "Character nicht gefunden" }, { status: 404 });
  }
  const characterName = character.name;

  // ── Resolve all assets ──
  const actor = (character as unknown as {
    actor?: { characterSheet?: { front?: string; profile?: string; fullBody?: string } };
  }).actor;

  const characterSheetUrls: string[] = [];
  if (actor?.characterSheet) {
    for (const angle of ["front", "profile", "fullBody"] as const) {
      const u = actor.characterSheet[angle];
      if (u) characterSheetUrls.push(u);
    }
  }
  const portraitUrl = actor?.characterSheet?.front
    || (character as unknown as { castSnapshot?: { portraitUrl?: string } }).castSnapshot?.portraitUrl
    || character.portraitUrl
    || undefined;
  if (!portraitUrl) {
    return Response.json({ error: "Character hat kein Portrait (characterSheet.front)" }, { status: 400 });
  }

  const landscapeUrl = sequence.landscapeRefUrl || undefined;

  // Preload all buffers in parallel
  console.log(`[Spike] Preloading assets: portrait, audio, ${characterSheetUrls.length} sheet imgs, landscape=${!!landscapeUrl}`);
  const [portraitBuffer, audioBuffer, landscapeBuffer, ...sheetBuffers] = await Promise.all([
    loadBlobBuffer(portraitUrl),
    loadBlobBuffer(scene.dialogAudioUrl),
    landscapeUrl ? loadBlobBuffer(landscapeUrl) : Promise.resolve(undefined),
    ...characterSheetUrls.map((u) => loadBlobBuffer(u)),
  ]);

  if (!portraitBuffer) return Response.json({ error: "Portrait konnte nicht geladen werden" }, { status: 500 });
  if (!audioBuffer) return Response.json({ error: "Audio konnte nicht geladen werden" }, { status: 500 });

  const validSheetBuffers: Buffer[] = sheetBuffers.filter((b): b is Buffer => !!b);
  const characterRefs: Buffer[] = validSheetBuffers.length > 0 ? validSheetBuffers : [portraitBuffer];

  // Audio duration drives clip length
  const dialogDurSec = (scene.audioEndMs - scene.audioStartMs) / 1000;
  const clipDurSec = Math.max(4, Math.ceil(dialogDurSec + 1.0));

  // Build a shared dialog prompt
  const { buildO3Prompt } = await import("@/lib/studio/kling-prompts");
  const charDesc = (character as unknown as { description?: string }).description
    || (actor as unknown as { description?: string })?.description;
  const sharedPrompt = buildO3Prompt({
    sceneDescription: scene.sceneDescription,
    camera: scene.camera,
    cameraMotion: scene.cameraMotion,
    emotion: scene.emotion,
    characterName,
    characterDescription: charDesc,
    location: scene.location || (sequence.location as string | undefined),
    mood: scene.mood || (sequence.atmosphereText as string | undefined),
    isDialog: true,
  });
  console.log(`[Spike] Shared prompt (${sharedPrompt.length} chars):`, sharedPrompt.substring(0, 200));

  // ── Helper: save variant video to blob ──
  const testRunId = Date.now();
  async function saveVariant(variant: Variant, videoBuffer: Buffer): Promise<string> {
    const path = `studio/${projectId}/tests/lipsync/${sequenceId}/scene-${String(sceneIndex).padStart(3, "0")}-${variant}-${testRunId}.mp4`;
    const blob = await put(path, videoBuffer, { access: "private", contentType: "video/mp4" });
    return blob.url;
  }

  // ── Variant A: Kling O3 + Kling LipSync (current baseline) ──
  async function runVariantA(): Promise<VariantResult> {
    const start = Date.now();
    try {
      const { klingO3, klingLipSync } = await import("@/lib/fal");
      const o3Url = await klingO3({
        imageBuffer: portraitBuffer!,
        prompt: sharedPrompt,
        durationSeconds: Math.ceil(Math.min(15, clipDurSec)),
        characterElements: characterRefs,
        generateAudio: false,
      });
      const videoRes = await fetch(o3Url);
      const videoBuf = Buffer.from(await videoRes.arrayBuffer());
      const syncedUrl = await klingLipSync(videoBuf, audioBuffer!);
      const syncedRes = await fetch(syncedUrl);
      const syncedBuf = Buffer.from(await syncedRes.arrayBuffer());
      const finalUrl = await saveVariant("A", syncedBuf);
      return {
        label: "Kling O3 + Kling LipSync (baseline)",
        provider: "kling-o3+kling-lipsync",
        url: finalUrl,
        cost: 0.084 * clipDurSec + 0.014 * clipDurSec,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        label: "Kling O3 + Kling LipSync (baseline)",
        provider: "kling-o3+kling-lipsync",
        error: (err as Error).message,
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Variant B: Kling O3 + Sync v3 (post-proc upgrade) ──
  async function runVariantB(): Promise<VariantResult> {
    const start = Date.now();
    try {
      const { klingO3, syncLipsyncV3 } = await import("@/lib/fal");
      const o3Url = await klingO3({
        imageBuffer: portraitBuffer!,
        prompt: sharedPrompt,
        durationSeconds: Math.ceil(Math.min(15, clipDurSec)),
        characterElements: characterRefs,
        generateAudio: false,
      });
      const videoRes = await fetch(o3Url);
      const videoBuf = Buffer.from(await videoRes.arrayBuffer());
      const syncedUrl = await syncLipsyncV3(videoBuf, audioBuffer!);
      const syncedRes = await fetch(syncedUrl);
      const syncedBuf = Buffer.from(await syncedRes.arrayBuffer());
      const finalUrl = await saveVariant("B", syncedBuf);
      return {
        label: "Kling O3 + Sync v3 (post-proc upgrade)",
        provider: "kling-o3+sync-v3",
        url: finalUrl,
        cost: 0.084 * clipDurSec + 0.133 * clipDurSec,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        label: "Kling O3 + Sync v3 (post-proc upgrade)",
        provider: "kling-o3+sync-v3",
        error: (err as Error).message,
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Variant C: OmniHuman 1.5 (portrait + audio talking head) ──
  async function runVariantC(): Promise<VariantResult> {
    const start = Date.now();
    try {
      const { omniHuman15 } = await import("@/lib/fal");
      const url = await omniHuman15({
        imageBuffer: portraitBuffer!,
        audioBuffer: audioBuffer!,
        prompt: sharedPrompt,
        resolution: "1080p",
      });
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const finalUrl = await saveVariant("C", buf);
      return {
        label: "OmniHuman 1.5 (portrait + audio talking head)",
        provider: "bytedance-omnihuman-1.5",
        url: finalUrl,
        cost: 0.16 * clipDurSec,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        label: "OmniHuman 1.5 (portrait + audio talking head)",
        provider: "bytedance-omnihuman-1.5",
        error: (err as Error).message,
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Variant D: Seedance 2.0 Reference-to-Video (multimodal) ──
  async function runVariantD(): Promise<VariantResult> {
    const start = Date.now();
    try {
      const { seedance2RefToVideo } = await import("@/lib/fal");
      const imageBuffers: Buffer[] = [...characterRefs];
      if (landscapeBuffer) imageBuffers.push(landscapeBuffer);
      // Seedance refs addressed as @Image1/@Audio1 — add guidance to prompt
      const seedancePrompt = [
        `Character @Image1 (${characterName})`,
        characterRefs.length > 1 ? `reference @Image2 / @Image3 for consistency` : null,
        landscapeBuffer ? `in location @Image${characterRefs.length + 1}` : null,
        `speaking with lip-sync to @Audio1.`,
        sharedPrompt,
      ].filter(Boolean).join(" ");

      const url = await seedance2RefToVideo({
        prompt: seedancePrompt,
        imageBuffers,
        audioBuffers: [audioBuffer!],
        resolution: "720p",
        duration: Math.min(15, Math.max(4, clipDurSec)),
        aspectRatio: "16:9",
        generateAudio: true,
      });
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const finalUrl = await saveVariant("D", buf);
      return {
        label: "Seedance 2.0 Ref-to-Video (multimodal all-in-one)",
        provider: "bytedance-seedance-2.0-ref",
        url: finalUrl,
        cost: 0,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        label: "Seedance 2.0 Ref-to-Video (multimodal all-in-one)",
        provider: "bytedance-seedance-2.0-ref",
        error: (err as Error).message,
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Run selected variants in parallel ──
  const runners: Record<Variant, () => Promise<VariantResult>> = {
    A: runVariantA,
    B: runVariantB,
    C: runVariantC,
    D: runVariantD,
  };
  console.log(`[Spike] Running variants: ${variants.join(", ")} in parallel for scene ${sceneIndex} (dur ${clipDurSec}s)`);
  const entries = await Promise.all(
    variants.map(async (v) => [v, await runners[v]()] as const),
  );
  const results = Object.fromEntries(entries) as Record<Variant, VariantResult>;

  return Response.json({
    sceneIndex,
    character: characterName,
    audioSec: dialogDurSec,
    clipSec: clipDurSec,
    testRunId,
    results,
  });
}
