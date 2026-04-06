/**
 * AI Video Director — Analyzes a story and creates a scene list for film generation.
 *
 * Takes the story text (with character markers) and the audio timeline,
 * and produces a structured list of film scenes with camera directions,
 * locations, moods, and timing.
 */

import Anthropic from "@anthropic-ai/sdk";
import { parseStorySegments } from "./story-parser";

const anthropic = new Anthropic();

// --- Types ---

export interface FilmScene {
  type: "dialog" | "landscape" | "transition";
  characterId?: string;
  spokenText?: string;
  sceneDescription: string;
  location: string;
  mood: string;
  camera: "close-up" | "medium" | "wide" | "slow-pan" | "zoom-in" | "zoom-out";
  durationHint: number; // seconds
  audioStartMs: number;
  audioEndMs: number;
}

export interface TimelineEntry {
  characterId: string;
  startMs: number;
  endMs: number;
}

// --- Director ---

const DIRECTOR_SYSTEM = `Du bist ein Film-Regisseur fuer animierte Kindergeschichten im KoalaTree-Stil.

Du analysierst eine Geschichte und erstellst eine Szenen-Liste fuer die automatische Film-Generierung.

Die Geschichte hat Charakter-Marker wie [KODA], [KIKI] etc. und eine Audio-Timeline die zeigt wann welcher Charakter spricht.

Regeln:
1. Jede Szene hat einen Typ: "dialog" (Charakter spricht), "landscape" (Szenen-Bild), oder "transition" (Uebergang)
2. Dialog-Szenen bekommen ein Close-Up des sprechenden Charakters
3. Wenn ein Charakter eine SZENE beschreibt (z.B. "und dann war da ein grosser See..."), erstelle eine Landscape-Szene DANACH
4. Fasse kurze aufeinanderfolgende Segmente desselben Charakters zusammen (nicht jeder Satz eine neue Szene)
5. Fuege Landscape-Szenen bei Ortswechseln oder stimmungsvollen Beschreibungen ein
6. Transitions bei grossen Zeitspruengen oder Szenenwechseln
7. Halte die Gesamtzahl der Szenen zwischen 8 und 25
8. Die audioStartMs/audioEndMs muessen exakt mit der Timeline uebereinstimmen

Antworte NUR mit validem JSON — ein Array von FilmScene-Objekten.`;

export async function analyzeStoryForFilm(
  storyText: string,
  timeline: TimelineEntry[]
): Promise<FilmScene[]> {
  // Parse the story segments for context
  const segments = parseStorySegments(storyText);

  // Build the prompt
  const prompt = `Analysiere diese Geschichte und erstelle eine Film-Szenen-Liste.

## Story-Text:
${storyText}

## Audio-Timeline (wann spricht wer):
${JSON.stringify(timeline, null, 2)}

## Story-Segmente (geparsed):
${segments.map((s, i) => `${i}: [${s.type}] ${s.characterId || s.sfxPrompt || s.ambiencePrompt} — "${s.text.substring(0, 80)}..."`).join("\n")}

Erstelle die Szenen-Liste als JSON-Array. Jede Szene:
{
  "type": "dialog" | "landscape" | "transition",
  "characterId": "koda" | "kiki" | "luna" | "mika" | "pip" | "sage" | "nuki" | null,
  "spokenText": "Was der Charakter sagt (nur bei dialog)",
  "sceneDescription": "Visuelle Beschreibung fuer die Bild/Video-Generierung",
  "location": "Wo die Szene spielt",
  "mood": "Stimmung und Lichtstimmung",
  "camera": "close-up" | "medium" | "wide" | "slow-pan" | "zoom-in" | "zoom-out",
  "durationHint": Sekunden,
  "audioStartMs": Start-Position im Audio,
  "audioEndMs": End-Position im Audio
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract JSON from response
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Find JSON array in response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI Director returned no valid JSON scene list");
  }

  const scenes: FilmScene[] = JSON.parse(jsonMatch[0]);

  // Validate and clean
  const validScenes = scenes.filter((s) => {
    if (!s.type || !s.sceneDescription) return false;
    if (s.type === "dialog" && !s.characterId) return false;
    return true;
  });

  console.log(`[Director] Analyzed story → ${validScenes.length} scenes`);
  return validScenes;
}
