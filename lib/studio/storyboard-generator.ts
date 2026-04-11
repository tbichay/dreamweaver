/**
 * KoalaTree Studio — Basis-Storyboard Generator
 *
 * Analyzes a story text and extracts story beats:
 * - Who speaks when (character markers)
 * - Emotional tone per beat
 * - Sound effects and ambience cues
 * - Estimated timing
 *
 * The basis storyboard is shared between Audio and Film rendering.
 * For audio-only: generates directly from beats.
 * For film: beats are expanded into a full screenplay with scenes.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "@/lib/ai-clients";
import type { BasisStoryboard, StoryBeat } from "./types";

const anthropic = createAnthropicClient();

const BEAT_EXTRACTOR_SYSTEM = `Du bist ein erfahrener Drehbuch-Analyst. Du analysierst Geschichten und zerlegst sie in Story-Beats.

## Was ist ein Story-Beat?
Ein Beat ist die kleinste Einheit einer Erzaehlung:
- Ein Charakter sagt etwas
- Ein Erzaehler beschreibt etwas
- Eine Pause fuer Atmosphaere
- Ein Soundeffekt-Moment

## Deine Aufgabe
Analysiere den Text und erstelle eine Liste von Story-Beats mit:
1. characterId: Wer spricht? (aus den [MARKER] im Text, oder "narrator" fuer Erzaehler, null fuer reine SFX)
2. text: Was wird gesagt/beschrieben
3. emotion: Emotionale Stimmung (neutral, happy, sad, excited, angry, scared, whisper, dramatic, calm)
4. sfx: Optionaler Soundeffekt (kurz beschrieben, Englisch)
5. ambience: Optionale Atmosphaere (kurz, Englisch)
6. pauseAfterMs: Pause in Millisekunden nach diesem Beat (0 bei Dialog-Fortsetzung, 500-2000 bei Szenen-Wechsel)

## Regeln
- Jeder [CHARAKTER]-Marker startet einen neuen Beat
- Erzaehltext zwischen Markern = eigener Beat mit characterId: "narrator"
- [PAUSE] = Beat mit leerem Text und pauseAfterMs: 2000
- [SFX:...] = Beat mit sfx-Beschreibung
- Kurze Saetze desselben Charakters ZUSAMMENFASSEN (nicht jedes Wort ein Beat)
- Emotionen aus dem Kontext ableiten, nicht nur aus Satzzeichen

Antworte NUR mit validem JSON — ein Array von Beat-Objekten.`;

/**
 * Generate a basis storyboard from a story text.
 * Extracts story beats with characters, emotions, SFX, and timing.
 */
export async function generateBasisStoryboard(
  storyText: string,
  language = "de",
): Promise<BasisStoryboard> {
  // Extract character markers from text
  const markerRegex = /\[([A-Z]+)\]/g;
  const markers = new Set<string>();
  let match;
  while ((match = markerRegex.exec(storyText)) !== null) {
    const marker = match[1];
    if (!["PAUSE", "SFX", "AMBIENCE"].includes(marker)) {
      markers.add(marker.toLowerCase());
    }
  }

  const prompt = `Analysiere diese Geschichte und erstelle die Story-Beats.

## Geschichte:
${storyText}

## Gefundene Charakter-Marker:
${[...markers].map((m) => `[${m.toUpperCase()}] → characterId: "${m}"`).join("\n")}

Erstelle die Beats als JSON-Array:
[
  {
    "characterId": "koda" | "narrator" | null,
    "text": "Der gesprochene/beschriebene Text",
    "emotion": "neutral" | "happy" | "sad" | "excited" | "angry" | "scared" | "whisper" | "dramatic" | "calm",
    "sfx": "optional sound effect description in English",
    "ambience": "optional ambient sound in English",
    "pauseAfterMs": 0
  },
  ...
]`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: BEAT_EXTRACTOR_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Extract JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  const rawMatch = text.match(/\[[\s\S]*\]/);
  const jsonStr = codeBlockMatch?.[1] || rawMatch?.[0];

  if (!jsonStr) {
    throw new Error("Basis-Storyboard: Kein valides JSON generiert");
  }

  const rawBeats = JSON.parse(jsonStr) as Array<{
    characterId: string | null;
    text: string;
    emotion: string;
    sfx?: string;
    ambience?: string;
    pauseAfterMs?: number;
  }>;

  // Process and enrich beats
  const beats: StoryBeat[] = rawBeats.map((raw, i) => {
    // Estimate duration: ~0.4s per word for speech, 0 for pauses
    const wordCount = raw.text.split(/\s+/).filter(Boolean).length;
    const estimatedDurationMs = raw.text ? Math.max(500, wordCount * 400) : (raw.pauseAfterMs || 1000);

    return {
      id: `beat-${i}`,
      index: i,
      characterId: raw.characterId,
      text: raw.text,
      emotion: (raw.emotion || "neutral") as StoryBeat["emotion"],
      sfx: raw.sfx || undefined,
      ambience: raw.ambience || undefined,
      pauseAfterMs: raw.pauseAfterMs || 0,
      estimatedDurationMs,
    };
  });

  const totalDuration = beats.reduce((sum, b) => sum + b.estimatedDurationMs + (b.pauseAfterMs || 0), 0);

  console.log(`[Storyboard] Generated ${beats.length} beats, ~${(totalDuration / 1000).toFixed(0)}s, ${markers.size} characters`);

  return {
    title: "", // Will be set by caller
    language,
    beats,
    totalEstimatedDurationMs: totalDuration,
    characters: [...markers],
  };
}
