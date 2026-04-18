/**
 * Central visual style definitions — ONE place to add/edit styles.
 * Used by: engine/page.tsx, library/page.tsx, portrait/route.ts,
 *          character-sheet/route.ts, library/generate/route.ts
 */

export interface VisualStyle {
  id: string;
  label: string;
  prompt: string;       // Full prompt for video/film generation (engine)
  styleHint: string;    // Shorter hint for image generation (portraits, props, locations)
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: "disney-2d",
    label: "2D Disney",
    prompt: "Traditional 2D hand-drawn cel animation in the style of 1990s Walt Disney Animation Studios Renaissance — The Lion King, Aladdin, Beauty and the Beast, The Jungle Book. Bold clean black ink outlines, flat saturated color fills with soft cel shading (2-3 tone shadows, no gradients), expressive Disney-style large eyes with round highlights, painted watercolor backgrounds with visible brushwork, warm golden hour palette. CRITICAL: NOT photorealistic, NOT 3D CGI, NOT Pixar-style, NOT anime, NOT pencil sketch, NOT realistic fur textures. Flat cel-shaded traditional animation ONLY.",
    styleHint: "Traditional 2D hand-drawn Disney cel animation, 1990s Disney Renaissance era (Lion King, Aladdin, Jungle Book look). Bold clean black ink outlines, flat saturated cel-shaded colors with 2-tone shadows (no gradients), large expressive Disney eyes, painted watercolor backgrounds. Explicitly NOT photorealistic, NOT 3D CGI, NOT Pixar, NOT realistic fur — flat hand-drawn cel animation ONLY.",
  },
  {
    id: "pixar-3d",
    label: "3D Pixar",
    prompt: "Pixar 3D animation style, smooth CGI rendering, subsurface scattering on skin, volumetric lighting, detailed textures, cinematic depth of field.",
    styleHint: "Pixar 3D animation style, smooth CGI rendering",
  },
  {
    id: "ghibli",
    label: "Studio Ghibli",
    prompt: "Studio Ghibli anime style, lush painted backgrounds, soft pastel colors, dreamy atmosphere, detailed nature, gentle watercolor textures.",
    styleHint: "Studio Ghibli anime style, soft pastel colors",
  },
  {
    id: "storybook",
    label: "Bilderbuch",
    prompt: "Children's storybook illustration style, soft colored pencil and watercolor, warm muted palette, cozy and inviting, textured paper feel.",
    styleHint: "Children's storybook illustration, soft colored pencil and watercolor",
  },
  {
    id: "realistic",
    label: "Realistisch",
    prompt: "Photorealistic CGI, lifelike textures and materials, natural lighting, cinematic color grading, shallow depth of field.",
    styleHint: "Photorealistic, cinematic lighting, shallow depth of field",
  },
  {
    id: "claymation",
    label: "Claymation",
    prompt: "Stop-motion claymation style, soft clay textures, slightly imperfect surfaces, warm directional lighting, miniature set design feel.",
    styleHint: "Stop-motion claymation style, soft clay textures, warm lighting",
  },
  {
    id: "koalatree",
    label: "KoalaTree Magic",
    prompt: "Warm animated cinematic style, rich digital painting aesthetic, lush detailed eucalyptus forest backgrounds, golden hour warm lighting with soft volumetric light rays, expressive anthropomorphic animal characters with big emotive eyes and detailed fur textures, magical atmosphere with gentle floating particles and fireflies, painterly brushstroke textures visible in backgrounds, Puss in Boots The Last Wish inspired rendering quality.",
    styleHint: "Warm animated cinematic style, rich digital painting, golden hour lighting, expressive detail, magical atmosphere with gentle particles, Puss in Boots The Last Wish inspired",
  },
  {
    id: "custom",
    label: "Eigener Style",
    prompt: "",
    styleHint: "High quality",
  },
];

/** Get style hint for image generation by style ID */
export function getStyleHint(styleId: string): string {
  return VISUAL_STYLES.find((s) => s.id === styleId)?.styleHint || "High quality";
}

/** Get full prompt for video/film generation by style ID */
export function getStylePrompt(styleId: string): string {
  return VISUAL_STYLES.find((s) => s.id === styleId)?.prompt || "";
}

/** Style options for <select> dropdowns (excludes 'custom') */
export const STYLE_OPTIONS = VISUAL_STYLES.filter((s) => s.id !== "custom");
