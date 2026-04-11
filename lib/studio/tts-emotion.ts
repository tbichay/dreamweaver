/**
 * TTS Emotion System — Authentic voice modulation for scenes
 *
 * Builds emotional voice settings + context text for ElevenLabs.
 * Uses both numerical voice parameters AND textual stage directions
 * via ElevenLabs' previous_text field for prosody control.
 *
 * Adapts to: visual style (Pixar=exaggerated, realistic=subtle),
 * directing style, and scene emotion.
 */

import type { CharacterVoiceSettings } from "@/lib/types";

interface EmotionResult {
  voiceSettings: Partial<CharacterVoiceSettings>;
  /** Stage direction as previous_text — influences prosody without changing dialogue */
  contextText: string;
}

interface EmotionInput {
  emotion: string;
  sceneDescription?: string;
  mood?: string;
  characterName?: string;
  spokenText?: string;
}

// ── Emotion Profiles ─────────────────────────────────────────────
// Each profile defines voice settings + a stage direction template

const EMOTION_PROFILES: Record<string, {
  stability: number;
  style: number;
  speed: number;
  direction: string;
}> = {
  scared: {
    stability: 0.20,
    style: 0.85,
    speed: 0.85,
    direction: "speaks with audible fear and a trembling voice, breathing shakily, words coming out rushed and unsteady",
  },
  whisper: {
    stability: 0.30,
    style: 0.70,
    speed: 0.80,
    direction: "whispers urgently, barely audible, as if afraid of being heard, voice tight and hushed",
  },
  angry: {
    stability: 0.15,
    style: 0.95,
    speed: 1.15,
    direction: "speaks with barely contained fury, voice raised and sharp, each word punched out with force",
  },
  excited: {
    stability: 0.20,
    style: 0.80,
    speed: 1.20,
    direction: "speaks with bubbling excitement, voice high and fast, barely able to contain enthusiasm",
  },
  joyful: {
    stability: 0.25,
    style: 0.75,
    speed: 1.15,
    direction: "speaks with warm joy and a bright smile in the voice, cheerful and melodic",
  },
  sad: {
    stability: 0.55,
    style: 0.40,
    speed: 0.80,
    direction: "speaks with deep sadness, voice heavy and slow, occasional pauses as if holding back tears",
  },
  dramatic: {
    stability: 0.25,
    style: 0.90,
    speed: 1.00,
    direction: "speaks with intense dramatic weight, deliberate pacing, each word carrying significance",
  },
  tense: {
    stability: 0.30,
    style: 0.85,
    speed: 0.95,
    direction: "speaks through clenched teeth with controlled tension, voice tight and measured, barely holding composure",
  },
  calm: {
    stability: 0.70,
    style: 0.25,
    speed: 0.90,
    direction: "speaks with serene calmness, gentle and measured, a soothing and reassuring tone",
  },
  neutral: {
    stability: 0.50,
    style: 0.50,
    speed: 1.00,
    direction: "speaks in a natural conversational tone",
  },
  happy: {
    stability: 0.30,
    style: 0.65,
    speed: 1.10,
    direction: "speaks with a happy, upbeat tone, light and pleasant",
  },
};

// ── Visual Style Intensity Multipliers ───────────────────────────
// Pixar/Disney characters are more expressive, realistic more subtle

const STYLE_INTENSITY: Record<string, number> = {
  "pixar-3d": 1.35,
  "disney-2d": 1.30,
  "storybook": 1.20,
  "ghibli": 0.80,
  "realistic": 1.00,
  "claymation": 1.15,
};

// ── Directing Style Speed Modifiers ──────────────────────────────

const DIRECTING_SPEED: Record<string, number> = {
  "pixar-classic": 1.05,    // Slightly faster, snappy dialogue
  "long-take": 0.90,        // Slower, more breathing room
  "dramatic": 0.95,         // Deliberate pacing
  "minimal": 0.92,          // Understated delivery
  "documentary": 0.95,      // Natural pacing
};

/**
 * Build emotional voice settings + context text for a scene.
 */
export function buildEmotionContext(
  input: EmotionInput,
  visualStyle?: string,
  directingStyle?: string,
): EmotionResult {
  const emotion = input.emotion || "neutral";
  const profile = EMOTION_PROFILES[emotion] || EMOTION_PROFILES.neutral;

  // Get style intensity multiplier
  const intensity = STYLE_INTENSITY[visualStyle || "realistic"] || 1.0;

  // Get directing speed modifier
  const directingSpeed = DIRECTING_SPEED[directingStyle || ""] || 1.0;

  // Apply intensity to voice settings
  // Intensity > 1 = more extreme (lower stability, higher style, faster speed changes)
  const stabilityDelta = (0.5 - profile.stability) * intensity;
  const styleDelta = (profile.style - 0.5) * intensity;
  const speedDelta = (profile.speed - 1.0) * intensity;

  const voiceSettings: Partial<CharacterVoiceSettings> = {
    stability: Math.max(0.10, Math.min(0.90, 0.5 - stabilityDelta)),
    style: Math.max(0.0, Math.min(1.0, 0.5 + styleDelta)),
    speed: Math.max(0.5, Math.min(2.0, (1.0 + speedDelta) * directingSpeed)),
  };

  // Build stage direction as previous_text
  const characterName = input.characterName || "The character";
  let direction = `[Stage direction: ${characterName} ${profile.direction}.`;

  // Add scene context if available
  if (input.mood) {
    direction += ` The mood is ${input.mood}.`;
  }
  if (input.sceneDescription) {
    // Use first 100 chars of scene description for context
    direction += ` Scene: ${input.sceneDescription.slice(0, 100)}.`;
  }

  // Add style-specific direction
  if (visualStyle === "pixar-3d" || visualStyle === "disney-2d") {
    direction += " The performance should be animated and expressive, like a Pixar/Disney character — slightly exaggerated emotions, clear vocal expressions.";
  } else if (visualStyle === "ghibli") {
    direction += " The performance should be gentle and understated, with quiet emotional depth, like a Studio Ghibli character.";
  } else if (visualStyle === "realistic") {
    direction += " The performance should be naturalistic and grounded, like a real person in a real situation.";
  }

  direction += "]";

  return {
    voiceSettings,
    contextText: direction,
  };
}

/**
 * Apply emotion settings to existing character voice settings.
 * Merges base settings with emotional adjustments.
 */
export function applyEmotion(
  baseSettings: CharacterVoiceSettings,
  emotion: EmotionResult,
): CharacterVoiceSettings {
  return {
    ...baseSettings,
    stability: emotion.voiceSettings.stability ?? baseSettings.stability,
    style: emotion.voiceSettings.style ?? baseSettings.style,
    speed: emotion.voiceSettings.speed ?? baseSettings.speed,
  };
}
