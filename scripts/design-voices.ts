/**
 * KoalaTree Voice Design Script
 *
 * Generiert Custom Voices über die ElevenLabs Voice Design API.
 * Speichert Preview-Audio zum Anhören und die Voice IDs.
 *
 * Usage:
 *   npx tsx scripts/design-voices.ts
 *
 * Voraussetzungen:
 *   - ELEVENLABS_API_KEY in .env.local
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("❌ ELEVENLABS_API_KEY nicht gefunden in .env.local");
  process.exit(1);
}

const VOICES = {
  koda: {
    name: "Koda — Der Weise Koala",
    description: `A warm, deep German male voice, around 55-60 years old. Perfect audio quality. Speaks with a gentle smile in the voice, slightly slower than normal. Think of a wise grandfather telling bedtime stories by a warm fireplace. Rich baritone, naturally calming, with slight breathiness that conveys warmth. Not theatrical or dramatic — genuinely warm and trustworthy. Clear, soft German articulation. Nostalgic tone evoking classic German children's radio plays from the 90s.`,
    previewText: `Hmm... weißt du was, kleiner Schatz? Ich erinnere mich da an etwas... Es war einmal, an einem warmen Sommerabend, als der Wind ganz sanft durch die Blätter des KoalaTrees wehte... Und dann... stell dir vor... begann etwas ganz Wunderbares.`,
  },
  kiki: {
    name: "Kiki — Die Lustige Kookaburra",
    description: `A bright, energetic young German female voice, around 25-30 years old. Perfect audio quality. Speaks with infectious enthusiasm and a playful lilt. Think of a fun, slightly mischievous friend who gets excited about everything. Higher pitch, expressive, with natural laughter in the voice. Quick, lively pacing with genuine warmth. Not childish or squeaky — authentically joyful and engaging. Natural German pronunciation.`,
    previewText: `Hihi! Oh mann, das muss ich dir erzählen! Also echt jetzt... das war SO lustig! Weißt du was passiert ist? Boah, warte warte warte... okay, also der kleine Frosch hat... nein, ich fang nochmal von vorne an. Hihi!`,
  },
};

const CANDIDATES_PER_VOICE = 3;

async function designVoice(
  voiceDesc: string,
  previewText: string,
): Promise<{ generatedVoiceId: string; audioBase64: string } | null> {
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create-previews", {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_description: voiceDesc,
        text: previewText,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`API Error ${response.status}: ${error}`);
      return null;
    }

    const data = await response.json();
    if (data.previews && data.previews.length > 0) {
      return {
        generatedVoiceId: data.previews[0].generated_voice_id,
        audioBase64: data.previews[0].audio_base_64,
      };
    }
    return null;
  } catch (err) {
    console.error("Request failed:", err);
    return null;
  }
}

async function saveVoice(generatedVoiceId: string, name: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview", {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_name: name,
        voice_description: `KoalaTree character voice: ${name}`,
        generated_voice_id: generatedVoiceId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Save Error ${response.status}: ${error}`);
      return null;
    }

    const data = await response.json();
    return data.voice_id;
  } catch (err) {
    console.error("Save failed:", err);
    return null;
  }
}

async function main() {
  const outputDir = path.resolve(__dirname, "../voice-previews");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("🎤 KoalaTree Voice Designer\n");
  console.log(`Generiere ${CANDIDATES_PER_VOICE} Kandidaten pro Charakter...\n`);

  for (const [charId, config] of Object.entries(VOICES)) {
    console.log(`\n══════════════════════════`);
    console.log(`🎭 ${config.name}`);
    console.log(`══════════════════════════\n`);

    for (let i = 0; i < CANDIDATES_PER_VOICE; i++) {
      console.log(`  Kandidat ${i + 1}/${CANDIDATES_PER_VOICE}...`);

      const result = await designVoice(config.description, config.previewText);

      if (result) {
        const filename = `${charId}-candidate-${i + 1}.mp3`;
        const filepath = path.join(outputDir, filename);

        const audioBuffer = Buffer.from(result.audioBase64, "base64");
        fs.writeFileSync(filepath, audioBuffer);

        console.log(`  ✅ Gespeichert: ${filepath}`);
        console.log(`     Voice ID: ${result.generatedVoiceId}`);
        console.log(`     Größe: ${(audioBuffer.length / 1024).toFixed(1)} KB\n`);
      } else {
        console.log(`  ❌ Fehlgeschlagen\n`);
      }

      // Rate limit: 1 Sekunde zwischen Requests
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n══════════════════════════`);
  console.log(`✅ Fertig!`);
  console.log(`\nAlle Preview-Dateien liegen in: ${outputDir}`);
  console.log(`\nNächste Schritte:`);
  console.log(`1. Höre dir die Previews an und wähle die beste Stimme pro Charakter`);
  console.log(`2. Notiere die Voice ID des Kandidaten`);
  console.log(`3. Setze ELEVENLABS_VOICE_KODA und ELEVENLABS_VOICE_KIKI in .env.local`);
  console.log(`4. Setze die Voice IDs auch auf Vercel (vercel env add)`);
}

main().catch(console.error);
