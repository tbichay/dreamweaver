/**
 * KoalaTree Shows System Seed
 *
 * Seeds the 7 KoalaTree actors and 15 Fokus templates into the new
 * Shows-System tables (Actor + FokusTemplate) — the source data stays
 * in lib/types.ts (CHARACTERS) and lib/prompts.ts (FORMAT_ANWEISUNGEN,
 * *_STIL functions, FORMAT_CAST). This seed is idempotent (upsert).
 *
 * The Kids-App continues to use those constants directly. This seed
 * creates a *parallel* Actor+FokusTemplate dataset that the new
 * Canzoia-facing Shows system reads from — so edits in the Studio
 * Shows-UI don't break the Kids-App.
 *
 * Run: npx tsx prisma/seed-shows.ts
 */

import { PrismaClient } from "@prisma/client";
import { CHARACTERS, STORY_FORMATE, PAEDAGOGISCHE_ZIELE, DAUER_OPTIONEN, StoryFormat } from "../lib/types";
import {
  KODA_STIL, KIKI_STIL, LUNA_STIL, MIKA_STIL, PIP_STIL, SAGE_STIL, NUKI_STIL,
  FORMAT_CAST, FORMAT_ANWEISUNGEN,
} from "../lib/prompts";

const prisma = new PrismaClient();

// ── Actor expertise + tone mapping ──────────────────────────────

const ACTOR_META: Record<string, { expertise: string[]; defaultTone: string; stilFn: (alter: number) => string }> = {
  koda: {
    expertise: ["storytelling", "kindermeditation", "naturgeschichten", "weisheit"],
    defaultTone: "warm-narrator",
    stilFn: KODA_STIL,
  },
  kiki: {
    expertise: ["humor", "comic-relief", "cheerful-commentary"],
    defaultTone: "cheeky-energetic",
    stilFn: KIKI_STIL,
  },
  luna: {
    expertise: ["meditation", "traumreisen", "entspannung", "guided-imagery"],
    defaultTone: "calm-coach",
    stilFn: LUNA_STIL,
  },
  mika: {
    expertise: ["abenteuer", "action-storytelling", "mut-aufbauen"],
    defaultTone: "energetic-adventurer",
    stilFn: MIKA_STIL,
  },
  pip: {
    expertise: ["science-explainer", "raetsel", "wissensvermittlung", "neugier"],
    defaultTone: "curious-explorer",
    stilFn: PIP_STIL,
  },
  sage: {
    expertise: ["philosophie", "reflexion", "tiefgang"],
    defaultTone: "philosophical",
    stilFn: SAGE_STIL,
  },
  nuki: {
    expertise: ["lebensfreude", "humor", "alltags-weisheit"],
    defaultTone: "joyful-clumsy",
    stilFn: NUKI_STIL,
  },
};

// ── Default UserInputSchema fields ──────────────────────────────

const LERNZIEL_OPTIONS = Object.entries(PAEDAGOGISCHE_ZIELE).map(([value, info]) => ({
  value,
  label: `${info.emoji} ${info.label}`,
}));

const DAUER_OPTIONS = Object.entries(DAUER_OPTIONEN).map(([value, info]) => ({
  value,
  label: info.label,
}));

function buildDefaultUserInputSchema(format: StoryFormat) {
  // Basic schema — every Fokus gets theme + lernziel + dauer + auto-inject
  // Show-creator can customize per-Fokus in Studio edit-UI.
  const formatInfo = STORY_FORMATE[format];
  return {
    version: 1,
    fields: [
      {
        kind: "text",
        id: "theme",
        label: "Worum soll's heute gehen?",
        placeholder: formatInfo.beschreibung.slice(0, 60) + "...",
        maxLength: 120,
        required: false,
      },
      {
        kind: "select",
        id: "lernziel",
        label: "Pädagogisches Ziel",
        options: LERNZIEL_OPTIONS,
        required: false,
      },
      {
        kind: "select",
        id: "dauer",
        label: "Dauer",
        options: DAUER_OPTIONS,
        default: "kurz",
        required: true,
      },
    ],
    autoInject: ["profile.displayName", "profile.ageYears", "profile.favoriteAnimal", "profile.interests"],
  };
}

// ── Seed Actors ─────────────────────────────────────────────────

async function seedActors() {
  console.log("\n→ Seeding Actors (7)…");
  for (const [id, char] of Object.entries(CHARACTERS)) {
    const meta = ACTOR_META[id];
    if (!meta) {
      console.warn(`  ⚠ Skipping ${id} — no ACTOR_META entry`);
      continue;
    }

    // Build ageStyles using the exported *_STIL functions at representative ages per band
    const ageStyles = {
      "3-5": meta.stilFn(4),
      "6-8": meta.stilFn(7),
      "9-12": meta.stilFn(10),
      "13+": meta.stilFn(14),
    };

    // persona = age-agnostic character core (description + role)
    const persona = `${char.name} — ${char.role} (${char.species}). ${char.description}`;

    await prisma.actor.upsert({
      where: { id },
      create: {
        id,
        displayName: char.name,
        species: char.species,
        role: char.role,
        description: char.description,
        emoji: char.emoji,
        color: char.color,
        portraitUrl: char.portrait,
        voiceProvider: "elevenlabs",
        voiceId: char.voiceId,
        voiceSettings: char.voiceSettings as any,
        persona,
        ageStyles,
        expertise: meta.expertise,
        defaultTone: meta.defaultTone,
        ownerUserId: null,
        ownerOrgId: null,
      },
      update: {
        displayName: char.name,
        species: char.species,
        role: char.role,
        description: char.description,
        emoji: char.emoji,
        color: char.color,
        portraitUrl: char.portrait,
        voiceId: char.voiceId,
        voiceSettings: char.voiceSettings as any,
        persona,
        ageStyles,
        expertise: meta.expertise,
        defaultTone: meta.defaultTone,
      },
    });
    console.log(`  ✓ ${char.emoji} ${char.name.padEnd(6)} (voiceId ${char.voiceId.slice(0, 10)}…, ${meta.expertise.length} expertise tags)`);
  }
}

// ── Seed FokusTemplates ─────────────────────────────────────────

// formatType entscheidet ob der Episode-Generator die Story-Framing
// ueberschreibt (Meditation/Affirmation/Breathwork) oder im klassischen
// Hoerspiel-Modus bleibt. Traumreise wird als Meditation gerahmt weil
// es effektiv eine gefuehrte Einschlaf-Meditation ist (Luna fuehrt durch
// Koerper-Reise → innere Bilder → Entspannung), nicht ein Plot-Hoerspiel.
const FORMAT_TYPE_MAP: Record<StoryFormat, string> = {
  traumreise: "meditation",
  fabel: "narrative",
  held: "narrative",
  dankbarkeit: "narrative",
  abenteuer: "narrative",
  meditation: "meditation",
  affirmation: "affirmation",
  reflexion: "narrative",
  gutenacht: "meditation",
  podcast: "narrative",
  quatsch: "narrative",
  raetsel: "narrative",
  wissen: "narrative",
  brief: "narrative",
  lebensfreude: "narrative",
};

async function seedFokusTemplates() {
  console.log("\n→ Seeding FokusTemplates (15)…");
  const formatKeys = Object.keys(STORY_FORMATE) as StoryFormat[];

  for (const format of formatKeys) {
    const info = STORY_FORMATE[format];
    const cast = FORMAT_CAST[format];
    const anweisung = FORMAT_ANWEISUNGEN[format];
    const formatType = FORMAT_TYPE_MAP[format] ?? "narrative";

    // Translate FORMAT_CAST into structured role hints.
    // We store both raw (per-actor role map) and grouped (by role) for flexibility.
    // `raw` spread into a plain index signature object so Prisma's InputJsonObject accepts it.
    const defaultCastRoles = {
      raw: { ...cast } as Record<string, string>,
      lead: Object.entries(cast).filter(([, r]) => r === "lead").map(([a]) => a),
      support: Object.entries(cast).filter(([, r]) => r === "support").map(([a]) => a),
      minimal: Object.entries(cast).filter(([, r]) => r === "minimal").map(([a]) => a),
    };

    const defaultDurationMin = info.minAlter <= 8 ? 5 : 10; // kids shorter, adults longer

    await prisma.fokusTemplate.upsert({
      where: { id: format },
      create: {
        id: format,
        displayName: info.label,
        description: info.beschreibung,
        emoji: info.emoji,
        formatType,
        systemPromptSkeleton: anweisung,
        interactionStyle: null,
        defaultCastRoles,
        defaultUserInputSchema: buildDefaultUserInputSchema(format),
        defaultDurationMin,
        minAlter: info.minAlter,
        maxAlter: info.maxAlter,
        supportedCategories: ["kids"], // MVP: all kids. Wellness/knowledge templates come later.
        ownerUserId: null,
        ownerOrgId: null,
      },
      update: {
        displayName: info.label,
        description: info.beschreibung,
        emoji: info.emoji,
        formatType, // re-seed patches formatType auch auf existierende Templates
        systemPromptSkeleton: anweisung,
        defaultCastRoles,
        defaultUserInputSchema: buildDefaultUserInputSchema(format),
        minAlter: info.minAlter,
        maxAlter: info.maxAlter,
      },
    });
    const leadName = defaultCastRoles.lead[0]?.toUpperCase() ?? "—";
    console.log(`  ✓ ${info.emoji} ${info.label.padEnd(24)} [lead: ${leadName.padEnd(5)}, type: ${formatType}] (${info.minAlter}+)`);
  }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  KoalaTree Shows-System — Seed");
  console.log("═══════════════════════════════════════════");

  await seedActors();
  await seedFokusTemplates();

  const actorCount = await prisma.actor.count();
  const fokusCount = await prisma.fokusTemplate.count();

  console.log("\n───────────────────────────────────────────");
  console.log(`  Seeded: ${actorCount} Actors, ${fokusCount} FokusTemplates`);
  console.log("───────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
