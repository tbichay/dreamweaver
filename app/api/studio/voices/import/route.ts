/**
 * Import existing ElevenLabs voices into the Voice Library
 *
 * GET: List available ElevenLabs voices (not yet in library)
 * POST: Import selected voices into library
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET with ?source=shared — Browse ElevenLabs shared voice library
 * GET without source — List own voices
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const language = searchParams.get("language") || "de";
  const gender = searchParams.get("gender");
  const age = searchParams.get("age");
  const useCase = searchParams.get("use_case");

  if (source === "shared") {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return Response.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });

    const params = new URLSearchParams({ page_size: "30", language });
    if (gender) params.set("gender", gender);
    if (age) params.set("age", age);
    if (useCase) params.set("use_cases", useCase);

    const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, {
      headers: { "xi-api-key": apiKey },
    });
    const data = await res.json();

    const voices = (data.voices || []).map((v: Record<string, unknown>) => ({
      voiceId: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url,
      age: v.age,
      gender: v.gender,
      accent: v.accent,
      descriptive: v.descriptive,
      useCase: v.use_case,
      category: v.category,
      language: (v.language as string) || language,
    }));

    return Response.json({ voices, source: "shared" });
  }

  // Original: list own voices
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });

  // Fetch all voices from ElevenLabs
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  const data = await res.json();

  // Get already imported voice IDs
  const existing = await prisma.voice.findMany({
    where: { userId: session.user.id },
    select: { voiceId: true },
  });
  const existingIds = new Set(existing.map((v) => v.voiceId));

  // Also check actor voice IDs
  const actorVoices = await prisma.digitalActor.findMany({
    where: { userId: session.user.id, voiceId: { not: null } },
    select: { voiceId: true },
  });
  const actorVoiceIds = new Set(actorVoices.map((a) => a.voiceId!));

  // Curated list of best voices for storytelling
  const curated: Record<string, { category: string; tags: string[]; recommended: boolean }> = {
    // German Professional — best for KoalaTree
    "dFA3XRddYScy6ylAYTIO": { category: "narrator", tags: ["deutsch", "maennlich", "warm", "maerchen", "helmut"], recommended: true },
    "umDfZDi2AcMmDUsDsBfA": { category: "narrator", tags: ["deutsch", "maennlich", "tief", "entspannt"], recommended: true },
    "nZpMT2RjIpaat0IaA7Sd": { category: "narrator", tags: ["deutsch", "maennlich", "alt", "weise", "grossvater"], recommended: true },
    "KDqku3FJfbImX6HKQdWA": { category: "narrator", tags: ["deutsch", "maennlich", "ruhig", "erzaehler"], recommended: true },
    "LRpNiUBlcqgIsKUzcrlN": { category: "character", tags: ["deutsch", "maennlich", "alt", "rau", "urgrossvater"], recommended: true },
    "ygoBNrnmTEdu5NtDTmAY": { category: "child", tags: ["deutsch", "maennlich", "jung", "lustig", "cartoon"], recommended: true },
    "zndmYEEoWWxRYyEL2ZZY": { category: "child", tags: ["deutsch", "weiblich", "jung", "verspielt", "cartoon"], recommended: true },
    "njAr83fGD1mgwXYCZL48": { category: "character", tags: ["deutsch", "maennlich", "cartoon", "verspielt"], recommended: true },
    "v7QyOKVRzHDBpjhEZHqo": { category: "character", tags: ["deutsch", "maennlich", "jung", "social-media"], recommended: false },
    "aTTiK3YzK3dXETpuDE2h": { category: "character", tags: ["deutsch", "maennlich", "jung", "selbstbewusst"], recommended: false },
    "IeQubAjK1ujbppIdhJw4": { category: "character", tags: ["deutsch", "maennlich", "jung", "natuerlich"], recommended: false },
    // English premade — best for international
    "JBFqnCBsd6RMkjVDRZzb": { category: "narrator", tags: ["englisch", "maennlich", "warm", "storyteller", "britisch"], recommended: true },
    "pFZP5JQG7iQjIQuC4Bku": { category: "narrator", tags: ["englisch", "weiblich", "elegant", "britisch"], recommended: false },
    "nPczCjzI2devNBz1zQrb": { category: "narrator", tags: ["englisch", "maennlich", "tief", "beruhigend"], recommended: false },
    "N2lVS1w4EtoT3dr4eOWO": { category: "character", tags: ["englisch", "maennlich", "rauh", "trickster"], recommended: false },
    "SOYHLrjzK2X1ezoPC6cr": { category: "character", tags: ["englisch", "maennlich", "krieger", "intensiv"], recommended: false },
    "cgSgspJ2msm6clMCkdW9": { category: "child", tags: ["englisch", "weiblich", "jung", "verspielt", "warm"], recommended: false },
    // KoalaTree custom
    "ayE8dwR5j1tan8dAMst0": { category: "narrator", tags: ["deutsch", "maennlich", "koda", "koalatree"], recommended: true },
    "9QdteJZBUzhRGxohwbsU": { category: "child", tags: ["deutsch", "weiblich", "kiki", "koalatree"], recommended: true },
    "HVqeRiiDmMNf0O9hGdSN": { category: "child", tags: ["deutsch", "weiblich", "luna", "koalatree"], recommended: true },
  };

  const voices = (data.voices || []).map((v: Record<string, unknown>) => {
    const labels = (v.labels || {}) as Record<string, string>;
    const info = curated[v.voice_id as string];
    return {
      voiceId: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url || null,
      elevenLabsCategory: v.category, // premade | professional | generated
      labels,
      alreadyImported: existingIds.has(v.voice_id as string),
      usedByActor: actorVoiceIds.has(v.voice_id as string),
      recommended: info?.recommended || false,
      libraryCategory: info?.category || (
        labels.use_case === "narrative_story" ? "narrator" :
        labels.use_case === "characters_animation" ? "character" :
        labels.age === "young" && labels.use_case !== "social_media" ? "child" : "custom"
      ),
      libraryTags: info?.tags || [
        labels.language === "de" ? "deutsch" : labels.language === "en" ? "englisch" : labels.language,
        labels.gender === "male" ? "maennlich" : labels.gender === "female" ? "weiblich" : labels.gender,
        labels.age === "old" ? "alt" : labels.age === "young" ? "jung" : labels.age,
        labels.descriptive,
      ].filter(Boolean) as string[],
      language: labels.language || "en",
      gender: labels.gender || "unknown",
    };
  });

  // Sort: recommended first, then by name
  voices.sort((a: { recommended: boolean; name: string }, b: { recommended: boolean; name: string }) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return a.name.localeCompare(b.name);
  });

  return Response.json({ voices, totalElevenLabs: voices.length, alreadyImported: existingIds.size });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    voices: Array<{
      voiceId: string;
      name: string;
      description?: string;
      previewUrl?: string;
      category?: string;
      tags?: string[];
    }>;
  };

  if (!body.voices || body.voices.length === 0) {
    return Response.json({ error: "Keine Stimmen zum Importieren" }, { status: 400 });
  }

  const imported: string[] = [];
  for (const v of body.voices) {
    // Skip if already imported
    const existing = await prisma.voice.findFirst({
      where: { userId: session.user.id, voiceId: v.voiceId },
    });
    if (existing) continue;

    await prisma.voice.create({
      data: {
        userId: session.user.id,
        name: v.name,
        description: v.description,
        voiceId: v.voiceId,
        previewUrl: v.previewUrl,
        voiceSettings: {
          stability: 0.35,
          similarity_boost: 0.75,
          style: 0.65,
          speed: 0.95,
        },
        category: v.category || "custom",
        tags: v.tags || [],
      },
    });
    imported.push(v.name);
  }

  return Response.json({ imported, count: imported.length });
}
