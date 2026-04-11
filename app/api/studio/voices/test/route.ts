/**
 * Voice Emotion Test — Generate a short TTS sample with a specific emotion
 *
 * POST: Generate emotional test audio for a voice
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";

export const maxDuration = 60;

const EMOTION_SAMPLES: Record<string, { text: string; stability: number; style: number; speed: number }> = {
  neutral: {
    text: "Es war einmal, in einem kleinen Dorf am Rande des Waldes, da lebte ein freundlicher Baecker.",
    stability: 0.50, style: 0.50, speed: 1.0,
  },
  happy: {
    text: "[laughing] Oh wie WUNDERBAR! Das ist ja das Beste was mir je passiert ist! Ich koennte die ganze Welt umarmen!",
    stability: 0.25, style: 0.80, speed: 1.15,
  },
  sad: {
    text: "Und dann... war alles vorbei. Still. Leer. Nur noch die Erinnerung... an das was einmal war.",
    stability: 0.55, style: 0.40, speed: 0.80,
  },
  scared: {
    text: "[fearful] Was war DAS?! Hast du das auch gehoert?! Oh nein... da kommt etwas... wir muessen hier WEG!",
    stability: 0.20, style: 0.85, speed: 0.90,
  },
  angry: {
    text: "NEIN! Das akzeptiere ich NICHT! Das ist eine UNVERSCHAEMTHEIT! So geht man nicht mit uns um!",
    stability: 0.15, style: 0.95, speed: 1.15,
  },
  excited: {
    text: "[excited] UND DANN — stellt euch vor — es ist TATSAECHLICH passiert! Ich konnte es NICHT glauben!",
    stability: 0.20, style: 0.80, speed: 1.20,
  },
  whisper: {
    text: "[whispering] Psst... komm naeher... ich verrate dir ein Geheimnis... aber du darfst es niemandem weitersagen...",
    stability: 0.30, style: 0.70, speed: 0.80,
  },
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    voiceId: string;
    emotion: string;
  };

  if (!body.voiceId || !body.emotion) {
    return Response.json({ error: "voiceId und emotion erforderlich" }, { status: 400 });
  }

  const sample = EMOTION_SAMPLES[body.emotion];
  if (!sample) {
    return Response.json({ error: `Unbekannte Emotion: ${body.emotion}` }, { status: 400 });
  }

  // Check cache first — look for this voice in the DB
  const cachedVoice = await prisma.voice.findFirst({
    where: { voiceId: body.voiceId },
    select: { id: true, emotionSamples: true },
  });
  const cached = cachedVoice?.emotionSamples as Record<string, string> | null;
  if (cached?.[body.emotion]) {
    return Response.json({ audioUrl: cached[body.emotion], emotion: body.emotion, cached: true });
  }

  try {
    const { generateSingleTTS } = await import("@/lib/elevenlabs");
    const settings = {
      stability: sample.stability,
      similarity_boost: 0.75,
      style: sample.style,
      speed: sample.speed,
      use_speaker_boost: true,
    };

    const { mp3 } = await generateSingleTTS(sample.text, body.voiceId, settings as any);
    const blob = await put(
      `studio/voices/test-${body.voiceId}-${body.emotion}.mp3`,
      Buffer.from(mp3),
      { access: "private", contentType: "audio/mpeg" },
    );

    // Cache in DB
    if (cachedVoice) {
      const updated = { ...(cached || {}), [body.emotion]: blob.url };
      await prisma.voice.update({
        where: { id: cachedVoice.id },
        data: { emotionSamples: updated },
      });
    }

    return Response.json({ audioUrl: blob.url, emotion: body.emotion });
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : "Test fehlgeschlagen",
    }, { status: 500 });
  }
}
