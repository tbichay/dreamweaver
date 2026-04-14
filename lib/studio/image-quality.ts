/**
 * KoalaTree Image Quality System
 *
 * Two-phase quality assurance for ALL image generation:
 *
 * Phase 1: PROMPT ENHANCEMENT (pre-generation)
 *   User prompt → Claude Haiku → professional, detailed prompt
 *   Cost: ~$0.005 per enhancement
 *
 * Phase 2: IMAGE VALIDATION (post-generation, optional)
 *   Generated image → Claude Vision → quality report
 *   Cost: ~$0.01 per validation
 *
 * Usage:
 *   const enhanced = await enhanceImagePrompt(userPrompt, "prop");
 *   // Show enhanced.prompt to user, let them edit
 *   const image = await generateImage(enhanced.prompt);
 *   const validation = await validateImage(imageBuffer, enhanced.prompt, "prop");
 *   if (!validation.passed) { re-generate with validation.improvedPrompt }
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// ── Types ──────────────────────────────────────────────────────

export type ImageCategory = "actor" | "prop" | "location" | "character-sheet" | "storyboard";

export interface EnhancedPrompt {
  original: string;
  prompt: string;        // The improved prompt for image generation
  reasoning: string;     // Why changes were made (for user transparency)
  warnings: string[];    // Potential issues detected in the original prompt
}

export interface ImageValidation {
  passed: boolean;
  score: number;         // 1-10 quality score
  issues: string[];      // List of problems found
  improvedPrompt: string; // Corrected prompt if issues found
}

// ── Prompt Enhancement ─────────────────────────────────────────

const CATEGORY_GUIDELINES: Record<ImageCategory, string> = {
  actor: `CHARACTER PORTRAIT guidelines:
- If anthropomorphic animal: DO NOT add human clothing to animal body parts. A kangaroo has natural fur legs, NOT human pants.
- Specify exact pose: "head and shoulders", "full body standing", "profile view"
- Include: age appearance, skin/fur tone, hair/fur style, eye color, expression
- For cartoon/animated: specify art style explicitly
- Always clarify what is worn vs natural (fur, feathers, scales)`,

  prop: `PROP/OBJECT guidelines:
- Specify which side is shown: "bottom view showing fins", "top-down view", "side profile"
- Include: material, color, size relative to human hand, condition (new/worn/ancient)
- For functional objects: show them in the CORRECT orientation and with CORRECT anatomy
  - Surfboard: fins on BOTTOM/underside, wax on TOP/deck
  - Sword: blade above, handle below
  - Cup: opening on top, base on bottom
- Describe key details that make it identifiable and physically correct`,

  location: `LOCATION/SET guidelines:
- Wide establishing shot showing the COMPLETE environment
- Include: time of day, weather, lighting direction, atmosphere
- No people or characters in the scene
- Describe foreground, midground, and background elements
- Include ground texture, sky, and architectural/natural details`,

  "character-sheet": `CHARACTER SHEET guidelines:
- Must show EXACT SAME character as reference image
- Specify angle precisely: "front-facing", "side profile left", "full body front"
- Maintain IDENTICAL: face, hair, clothing, accessories, art style
- Background should be simple/neutral`,

  storyboard: `STORYBOARD FRAME guidelines:
- Cinematic composition matching the scene description
- Place character(s) from reference INTO the location
- Match camera angle: close-up, medium, wide, etc.
- Show emotion through body language and facial expression
- Include environmental details from the scene description`,
};

/**
 * Enhance a user's image generation prompt using Claude Haiku.
 * Makes it more detailed, technically correct, and visually precise.
 */
export async function enhanceImagePrompt(
  userPrompt: string,
  category: ImageCategory,
  style?: string,
  additionalContext?: string,
): Promise<EnhancedPrompt> {
  const styleHint = style ? `Visual style: ${style}. ` : "";
  const guidelines = CATEGORY_GUIDELINES[category];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `You are an expert prompt engineer for AI image generation (GPT-Image / DALL-E).

Improve this image prompt to be more detailed, technically accurate, and produce better results.

CATEGORY: ${category}
${guidelines}

${styleHint}${additionalContext ? `Additional context: ${additionalContext}\n` : ""}
USER PROMPT: "${userPrompt}"

Respond in this JSON format:
{
  "prompt": "The improved, detailed prompt in English",
  "reasoning": "Brief explanation of what you changed and why (in German, 1-2 sentences)",
  "warnings": ["List of potential issues", "in the original prompt (in German)"]
}

Rules:
- Output prompt MUST be in English (image AI works best in English)
- Keep the user's core intent — don't change WHAT they want, improve HOW it's described
- Add missing details: orientation, materials, lighting, composition
- Fix anatomical/physical impossibilities
- Add "No text, no watermarks, no logos" at the end
- Reasoning and warnings in German`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON from response (might have markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        original: userPrompt,
        prompt: parsed.prompt || userPrompt,
        reasoning: parsed.reasoning || "",
        warnings: parsed.warnings || [],
      };
    }
  } catch { /* fallback below */ }

  // Fallback: return original prompt
  return {
    original: userPrompt,
    prompt: userPrompt,
    reasoning: "Prompt konnte nicht verbessert werden",
    warnings: [],
  };
}

// ── Scene Description Enhancement ─────────────────────────────

/**
 * Enhance/correct a scene description for video generation using Claude.
 * User provides a correction in any language, AI rewrites the full description.
 */
export async function enhanceSceneDescription(options: {
  currentDescription: string;
  userCorrection: string;
  sceneType: "landscape" | "dialog" | "transition";
  characterName?: string;
  characterDescription?: string;
  location?: string;
  previousSceneDescription?: string;
}): Promise<{ description: string; changes: string }> {
  const context = [
    options.characterName ? `Character: ${options.characterName}` : "",
    options.characterDescription ? `Appearance: ${options.characterDescription}` : "",
    options.location ? `Location: ${options.location}` : "",
    options.previousSceneDescription ? `Previous scene: ${options.previousSceneDescription.slice(0, 200)}` : "",
  ].filter(Boolean).join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `Du bist ein Film-Regisseur der Szenen-Beschreibungen fuer Video-KI (Kling AI) optimiert.

AKTUELLE BESCHREIBUNG:
"${options.currentDescription}"

USER-KORREKTUR:
"${options.userCorrection}"

${context ? `KONTEXT:\n${context}\n` : ""}
SCHREIBE die Beschreibung NEU — integriere die Korrektur natuerlich in den bestehenden Text.

PFLICHT-REGELN:
- Auf ENGLISCH schreiben (Video-AI versteht Englisch am besten)
- 4-6 Saetze, MAXIMUM 700 Zeichen
- HAENDE beschreiben: Was tun sie? Wie fest greifen sie? Welche Hand?
- GESICHT beschreiben: Augen, Mund, Blickrichtung, Ausdruck
- KOERPER beschreiben: Haltung, Gewicht, Balance, Bewegungsrichtung
- UMGEBUNG: Wie reagiert Kleidung/Haar auf Wind/Wasser?
- LICHT: Woher kommt es? Wie faellt es auf den Charakter?
- Ende mit: "Natural fluid motion, not static, not frozen."
- Wenn ein FAHRZEUG vorkommt: Fahrer/Beifahrer MUESSEN sichtbar sein
- Wenn jemand EIN/AUSSTEIGT: Schritt fuer Schritt beschreiben

Antworte als JSON:
{
  "description": "Die neue, verbesserte Beschreibung auf Englisch",
  "changes": "Kurze Zusammenfassung was geaendert wurde (auf Deutsch, 1 Satz)"
}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: parsed.description || options.currentDescription,
        changes: parsed.changes || "Beschreibung aktualisiert",
      };
    }
  } catch { /* fallback */ }

  return { description: options.currentDescription, changes: "Konnte nicht verbessert werden" };
}

// ── Image Validation ───────────────────────────────────────────

/**
 * Validate a generated image using Claude Vision.
 * Checks for anatomical errors, wrong orientations, style mismatches.
 */
export async function validateImage(
  imageBase64: string,
  expectedPrompt: string,
  category: ImageCategory,
): Promise<ImageValidation> {
  const guidelines = CATEGORY_GUIDELINES[category];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: imageBase64 },
        },
        {
          type: "text",
          text: `Evaluate this AI-generated image against the prompt and guidelines.

PROMPT: "${expectedPrompt}"

CATEGORY GUIDELINES:
${guidelines}

Check for:
1. Does it match the prompt intent?
2. Any anatomical errors? (wrong number of limbs, impossible poses)
3. Any orientation errors? (objects upside down, wrong perspective)
4. Style consistency?
5. Unwanted text/watermarks?
6. Physical impossibilities? (human clothes on animal legs, etc.)

Respond in JSON:
{
  "passed": true/false,
  "score": 1-10,
  "issues": ["Issue 1 in German", "Issue 2"],
  "improvedPrompt": "Corrected prompt in English if issues found, empty string if passed"
}`,
        },
      ],
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        passed: parsed.passed ?? true,
        score: parsed.score ?? 7,
        issues: parsed.issues || [],
        improvedPrompt: parsed.improvedPrompt || "",
      };
    }
  } catch { /* fallback */ }

  return { passed: true, score: 7, issues: [], improvedPrompt: "" };
}
