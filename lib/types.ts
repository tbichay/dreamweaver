export interface HoererProfil {
  id: string;
  name: string;
  geburtsdatum?: string; // ISO date string
  alter?: number;        // deprecated, berechnet aus geburtsdatum
  geschlecht?: "m" | "w" | "d";
  interessen: string[];
  lieblingsfarbe?: string;
  lieblingstier?: string;
  charaktereigenschaften: string[];
  herausforderungen?: string[];
  tags?: string[];       // Freie Tags
}

// Backwards compatibility
export type KindProfil = HoererProfil;

export type StoryFormat =
  | "traumreise"
  | "fabel"
  | "held"
  | "dankbarkeit"
  | "abenteuer"
  | "meditation"
  | "affirmation"
  | "reflexion";

export type PaedagogischesZiel =
  | "selbstbewusstsein"
  | "dankbarkeit"
  | "mut"
  | "empathie"
  | "achtsamkeit"
  | "aengste"
  | "kreativitaet";

export type StoryDauer = "kurz" | "mittel" | "lang";

export interface StoryConfig {
  kindProfilId: string; // bleibt für API-Kompatibilität
  format: StoryFormat;
  ziel: PaedagogischesZiel;
  dauer: StoryDauer;
  besonderesThema?: string;
}

export interface Geschichte {
  id: string;
  config: StoryConfig;
  kindName: string;
  text: string;
  audioUrl?: string;
  erstelltAm: string;
}

export interface StoryFormatInfo {
  label: string;
  beschreibung: string;
  emoji: string;
  minAlter: number;
  maxAlter: number;
  koala?: string; // welcher Koala erzählt
}

export const STORY_FORMATE: Record<StoryFormat, StoryFormatInfo> = {
  traumreise: {
    label: "Traumreise",
    beschreibung: "Eine sanfte Reise durch magische Welten zum Einschlafen",
    emoji: "🌿",
    minAlter: 2,
    maxAlter: 10,
    koala: "Luna",
  },
  fabel: {
    label: "Weisheitsgeschichte",
    beschreibung: "Koda erzählt eine Geschichte, die er selbst erlebt hat",
    emoji: "🦉",
    minAlter: 3,
    maxAlter: 14,
    koala: "Koda",
  },
  held: {
    label: "Dein Abenteuer",
    beschreibung: "Du bist der Held — Koda erzählt deine Geschichte",
    emoji: "🌟",
    minAlter: 4,
    maxAlter: 14,
    koala: "Koda",
  },
  dankbarkeit: {
    label: "Dankbarkeits-Moment",
    beschreibung: "Gemeinsam auf den Tag zurückblicken und dankbar sein",
    emoji: "🍃",
    minAlter: 3,
    maxAlter: 99,
    koala: "Koda",
  },
  abenteuer: {
    label: "Mutiges Abenteuer",
    beschreibung: "Eine spannende Geschichte voller Herausforderungen mit Mika",
    emoji: "⚔️",
    minAlter: 6,
    maxAlter: 16,
    koala: "Mika",
  },
  meditation: {
    label: "Geführte Meditation",
    beschreibung: "Luna führt dich durch eine tiefe, beruhigende Meditation",
    emoji: "🧘",
    minAlter: 8,
    maxAlter: 99,
    koala: "Luna",
  },
  affirmation: {
    label: "Positive Affirmationen",
    beschreibung: "Stärkende Botschaften, verpackt in eine kurze Geschichte",
    emoji: "✨",
    minAlter: 5,
    maxAlter: 99,
    koala: "Koda",
  },
  reflexion: {
    label: "Stille Reflexion",
    beschreibung: "Sage lädt ein zum Nachdenken über die wichtigen Dinge im Leben",
    emoji: "🪷",
    minAlter: 13,
    maxAlter: 99,
    koala: "Sage",
  },
};

/**
 * Gibt Story-Formate zurück, die für ein bestimmtes Alter passend sind.
 */
export function getFormateForAlter(alter: number): Partial<Record<StoryFormat, StoryFormatInfo>> {
  const result: Partial<Record<StoryFormat, StoryFormatInfo>> = {};
  for (const [key, value] of Object.entries(STORY_FORMATE)) {
    if (alter >= value.minAlter && alter <= value.maxAlter) {
      result[key as StoryFormat] = value;
    }
  }
  return result;
}

export const PAEDAGOGISCHE_ZIELE: Record<PaedagogischesZiel, { label: string; beschreibung: string; emoji: string }> = {
  selbstbewusstsein: {
    label: "Selbstbewusstsein",
    beschreibung: "Stärkt den Glauben an die eigenen Fähigkeiten",
    emoji: "💪",
  },
  dankbarkeit: {
    label: "Dankbarkeit",
    beschreibung: "Fördert Zufriedenheit und Wertschätzung",
    emoji: "🌻",
  },
  mut: {
    label: "Mut & Resilienz",
    beschreibung: "Hilft, Herausforderungen mit Zuversicht zu begegnen",
    emoji: "🦁",
  },
  empathie: {
    label: "Empathie",
    beschreibung: "Fördert Mitgefühl und Freundlichkeit",
    emoji: "💕",
  },
  achtsamkeit: {
    label: "Achtsamkeit",
    beschreibung: "Bringt innere Ruhe und Gelassenheit",
    emoji: "🧘",
  },
  aengste: {
    label: "Umgang mit Ängsten",
    beschreibung: "Hilft, Ängste sanft zu überwinden",
    emoji: "🌈",
  },
  kreativitaet: {
    label: "Kreativität",
    beschreibung: "Weckt Vorstellungskraft und Fantasie",
    emoji: "🎨",
  },
};

export const DAUER_OPTIONEN: Record<StoryDauer, { label: string; minuten: number }> = {
  kurz: { label: "Kurz (~5 Min)", minuten: 5 },
  mittel: { label: "Mittel (~10 Min)", minuten: 10 },
  lang: { label: "Lang (~15 Min)", minuten: 15 },
};

// DEPRECATED — Use getInteressenFuerAlter() from lib/utils.ts instead
export const INTERESSEN_VORSCHLAEGE = [
  "Dinosaurier", "Weltraum", "Tiere", "Prinzessinnen", "Ritter",
  "Meerjungfrauen", "Superhelden", "Natur & Wald", "Ozean & Meer",
  "Magie & Zauberei", "Musik", "Sport", "Fahrzeuge",
  "Kochen & Backen", "Bauen & Konstruieren",
];

// DEPRECATED — Use getCharakterFuerAlter() from lib/utils.ts instead
export const CHARAKTER_VORSCHLAEGE = [
  "neugierig", "schüchtern", "mutig", "kreativ", "energisch",
  "sensibel", "lustig", "nachdenklich", "hilfsbereit", "abenteuerlustig",
];
