/**
 * Studio Voices API — CRUD for Voice Library
 *
 * GET: List all voices for current user
 * POST: Create a new voice (design + save via ElevenLabs)
 * PUT: Update voice metadata
 * DELETE: Delete a voice
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";

export const maxDuration = 800;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const voices = await prisma.voice.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { actors: true } } },
  });

  return Response.json({ voices });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
    sampleText?: string;
  };

  if (!body.name || !body.description) {
    return Response.json({ error: "Name und Beschreibung sind erforderlich" }, { status: 400 });
  }

  try {
    // Step 1: Enhance description with AI
    let enhancedDescription = body.description;
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const ai = new Anthropic();
      const enhancement = await ai.messages.create({
        model: "claude-haiku-3-20240307",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Convert this voice description into an optimal ElevenLabs voice_description prompt in English. Focus ONLY on vocal qualities: age, gender, accent, tone, pacing, warmth, energy, audio quality.

Input: "${body.description}"

Reply with ONLY the optimized English voice description. Max 2 sentences.`,
        }],
      });
      const text = enhancement.content[0];
      if (text && text.type === "text" && text.text.length > 10) {
        enhancedDescription = text.text.trim();
      }
    } catch { /* use original */ }

    // Step 2: Design voice via ElevenLabs
    const { designVoice, saveDesignedVoice, generateSingleTTS } = await import("@/lib/elevenlabs");
    const designed = await designVoice(enhancedDescription, body.sampleText);

    // Step 3: Save voice permanently
    const permanentVoiceId = await saveDesignedVoice(
      body.name,
      enhancedDescription,
      designed.generatedVoiceId,
    );

    // Step 4: Generate expressive preview with saved voice
    const voiceSettings = {
      stability: 0.35,
      similarity_boost: 0.75,
      style: 0.65,
      use_speaker_boost: true,
      speed: 0.95,
    };

    let previewUrl: string | undefined;
    try {
      const emotionalSample = "Es war einmal... vor langer, langer Zeit... [fearful] Oh NEIN! Was war DAS?! [laughing] Hahaha! [whispering] Psst, komm naeher... [excited] Und DANN ist es wirklich PASSIERT! Und so lebten sie gluecklich... bis ans Ende ihrer Tage.";
      const { mp3 } = await generateSingleTTS(emotionalSample, permanentVoiceId, voiceSettings as any);
      const blob = await put(
        `studio/voices/${permanentVoiceId}-preview-${Date.now()}.mp3`,
        Buffer.from(mp3),
        { access: "private", contentType: "audio/mpeg" },
      );
      previewUrl = blob.url;
    } catch {
      // Use design preview as fallback
      if (designed.previewAudioBase64) {
        const buf = Buffer.from(designed.previewAudioBase64, "base64");
        const blob = await put(
          `studio/voices/${permanentVoiceId}-preview-${Date.now()}.mp3`,
          buf,
          { access: "private", contentType: "audio/mpeg" },
        );
        previewUrl = blob.url;
      }
    }

    // Step 5: Create Voice record
    const voice = await prisma.voice.create({
      data: {
        userId: session.user.id,
        name: body.name,
        description: body.description,
        voiceId: permanentVoiceId,
        voiceSettings: JSON.parse(JSON.stringify(voiceSettings)),
        previewUrl,
        category: body.category || "custom",
        tags: body.tags || [],
      },
    });

    return Response.json({ voice }, { status: 201 });
  } catch (err) {
    console.error("[Voices] Create failed:", err);
    return Response.json({
      error: err instanceof Error ? err.message : "Voice-Erstellung fehlgeschlagen",
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    id: string;
    updates: {
      name?: string;
      description?: string;
      category?: string;
      tags?: string[];
      voiceSettings?: Record<string, unknown>;
    };
  };

  if (!body.id) return Response.json({ error: "ID erforderlich" }, { status: 400 });

  const existing = await prisma.voice.findFirst({
    where: { id: body.id, userId: session.user.id },
  });
  if (!existing) return Response.json({ error: "Nicht gefunden" }, { status: 404 });

  const voice = await prisma.voice.update({
    where: { id: body.id },
    data: {
      ...(body.updates.name && { name: body.updates.name }),
      ...(body.updates.description !== undefined && { description: body.updates.description }),
      ...(body.updates.category !== undefined && { category: body.updates.category }),
      ...(body.updates.tags && { tags: body.updates.tags }),
      ...(body.updates.voiceSettings && { voiceSettings: JSON.parse(JSON.stringify(body.updates.voiceSettings)) }),
    },
  });

  return Response.json({ voice });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ID erforderlich" }, { status: 400 });

  const existing = await prisma.voice.findFirst({
    where: { id, userId: session.user.id },
    include: { _count: { select: { actors: true } } },
  });
  if (!existing) return Response.json({ error: "Nicht gefunden" }, { status: 404 });

  if (existing._count.actors > 0) {
    return Response.json({
      error: `Stimme wird von ${existing._count.actors} Actor(s) verwendet. Erst dort entfernen.`,
    }, { status: 400 });
  }

  await prisma.voice.delete({ where: { id } });
  return Response.json({ deleted: true });
}
