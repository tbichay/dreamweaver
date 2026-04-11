/**
 * Studio Actor Voice API — Voice Design + Save
 *
 * POST: Design a new voice from description (returns preview)
 * PUT: Save the designed voice permanently (updates actor with voiceId)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";
import { designVoice, saveDesignedVoice } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    description: string;       // Voice description for ElevenLabs (e.g. "deep male voice, warm")
    sampleText?: string;       // Custom sample text to preview
    actorId?: string;
  };

  if (!body.description) {
    return Response.json({ error: "Stimm-Beschreibung ist erforderlich" }, { status: 400 });
  }

  try {
    // Enhance the voice description with AI for better results
    let enhancedDescription = body.description;
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const ai = new Anthropic();
      const enhancement = await ai.messages.create({
        model: "claude-haiku-3-20240307",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Convert this voice description into an optimal ElevenLabs voice_description prompt.
Keep it in English (ElevenLabs works best in English). Focus ONLY on vocal qualities, not appearance.
Include: age, gender, accent, tone, pacing, warmth, energy level, audio quality.

Input: "${body.description}"

Reply with ONLY the optimized English voice description, nothing else. Max 2 sentences.`,
        }],
      });
      const enhanced = enhancement.content[0];
      if (enhanced && enhanced.type === "text" && enhanced.text.length > 10) {
        enhancedDescription = enhanced.text.trim();
        console.log(`[VoiceDesign] Enhanced: "${body.description}" → "${enhancedDescription}"`);
      }
    } catch {
      // AI enhancement is optional, use original if it fails
    }

    const result = await designVoice(enhancedDescription, body.sampleText);

    // Save preview audio to blob for playback
    let previewUrl: string | undefined;
    if (result.previewAudioBase64) {
      const audioBuffer = Buffer.from(result.previewAudioBase64, "base64");
      const blob = await put(
        `studio/actors/voice-preview-${Date.now()}.mp3`,
        audioBuffer,
        { access: "private", contentType: "audio/mpeg" },
      );
      previewUrl = blob.url;
    }

    // If actorId provided, update the actor with preview info
    if (body.actorId) {
      const actor = await prisma.digitalActor.findFirst({
        where: { id: body.actorId, userId: session.user.id },
      });
      if (actor) {
        await prisma.digitalActor.update({
          where: { id: body.actorId },
          data: { voicePreviewUrl: previewUrl },
        });
      }
    }

    return Response.json({
      generatedVoiceId: result.generatedVoiceId,
      previewUrl,
    });
  } catch (err) {
    console.error("[VoiceDesign] Error:", err);
    return Response.json({
      error: err instanceof Error ? err.message : "Voice Design fehlgeschlagen",
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    actorId: string;
    name: string;
    description: string;
    generatedVoiceId: string;
    voiceSettings?: Record<string, unknown>;
  };

  if (!body.actorId || !body.generatedVoiceId) {
    return Response.json({ error: "actorId und generatedVoiceId sind erforderlich" }, { status: 400 });
  }

  // Verify ownership
  const actor = await prisma.digitalActor.findFirst({
    where: { id: body.actorId, userId: session.user.id },
  });
  if (!actor) return Response.json({ error: "Actor nicht gefunden" }, { status: 404 });

  try {
    // Save voice permanently on ElevenLabs
    const permanentVoiceId = await saveDesignedVoice(
      body.name || actor.name,
      body.description || actor.description || "",
      body.generatedVoiceId,
    );

    // Expressive default settings (like kids app characters — low stability = more emotion)
    const defaultSettings = body.voiceSettings || {
      stability: 0.35,          // Low = more expressive, emotional variation
      similarity_boost: 0.75,   // High = closer to designed voice
      style: 0.65,              // High = more personality and expression
      use_speaker_boost: true,
      speed: 0.95,              // Slightly slow for storytelling
    };

    // Generate an expressive TTS preview with the saved voice
    let expressivePreviewUrl: string | undefined;
    try {
      const { generateSingleTTS } = await import("@/lib/elevenlabs");
      const emotionalSample = "Es war einmal... vor langer, langer Zeit... [fearful] Oh NEIN! Was war DAS?! [laughing] Hahaha, das war ja nur ein kleines Eichhoernchen! [whispering] Psst, komm naeher... ich erzaehl dir was... [excited] Und DANN ist es wirklich PASSIERT! Es war UNGLAUBLICH! Und so lebten sie gluecklich... bis ans Ende ihrer Tage.";
      const { mp3 } = await generateSingleTTS(emotionalSample, permanentVoiceId, defaultSettings as any);
      const previewBlob = await put(
        `studio/actors/voice-expressive-${Date.now()}.mp3`,
        Buffer.from(mp3),
        { access: "private", contentType: "audio/mpeg" },
      );
      expressivePreviewUrl = previewBlob.url;
    } catch (err) {
      console.warn("[Voice] Expressive preview generation failed:", err);
    }

    // Update actor with permanent voice ID + expressive preview
    const updatedActor = await prisma.digitalActor.update({
      where: { id: body.actorId },
      data: {
        voiceId: permanentVoiceId,
        voiceSettings: JSON.parse(JSON.stringify(defaultSettings)),
        ...(expressivePreviewUrl && { voicePreviewUrl: expressivePreviewUrl }),
      },
    });

    return Response.json({
      actor: updatedActor,
      voiceId: permanentVoiceId,
    });
  } catch (err) {
    console.error("[VoiceSave] Error:", err);
    return Response.json({
      error: err instanceof Error ? err.message : "Voice speichern fehlgeschlagen",
    }, { status: 500 });
  }
}
