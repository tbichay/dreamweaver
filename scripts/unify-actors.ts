/**
 * Unification Phase 2 — Data-Migration DigitalActor → Actor
 *
 * Kopiert alle DigitalActor-Rows in die unified `Actor`-Tabelle (oder
 * linkt sie zu einer bereits gematchten). Idempotent: bereits migrierte
 * DigitalActors (`DigitalActor.actorId IS NOT NULL`) werden uebersprungen.
 *
 * Strategie (pro DigitalActor):
 *   1. Wenn `actorId` schon gesetzt → skip (bereits migriert)
 *   2. Sonst: neuen Actor anlegen mit
 *        id = `${slugify(name)}-${da.id.slice(-6)}`
 *        displayName, ownerUserId, voiceId (oder fallback), voiceSettings,
 *        persona="" (wird UI-spaeter zu fuellen), ageStyles=null,
 *        characterSheet/outfit/traits/style/tags/portraitAssetId aus DA
 *        libraryVoiceId, voiceDescription aus DA
 *      → und `DigitalActor.actorId = newActor.id` setzen.
 *
 * Duplikate: wenn der User historisch "Luna" 3x als DigitalActor angelegt
 * hat (verschiedene Test-Runs), werden daraus 3x Actor. Das ist OK —
 * jedes Duplikat hat evtl. andere Portraits/voiceSettings und sollte
 * nicht verloren gehen. Der Admin kann im Library-UI spaeter mergen.
 *
 * Wichtig: `StudioCharacter` referenziert weiter DigitalActor.id — das
 * bleibt waehrend der Phase-3-Uebergangszeit so. Neue Shows-UI-Flows
 * lesen via Actor.id. StudioCharacter wird in einer spaeteren Phase
 * umgezogen.
 *
 * Usage:
 *   npx tsx scripts/unify-actors.ts           # Run migration
 *   npx tsx scripts/unify-actors.ts --dry     # Dry-run (nur loggen)
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const DRY = process.argv.includes("--dry");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "actor";
}

type Stats = {
  total: number;
  alreadyLinked: number;
  created: number;
  errors: number;
};

async function main() {
  console.log(`\n=== Unify Actors ${DRY ? "(DRY RUN)" : ""} ===\n`);

  const stats: Stats = {
    total: 0,
    alreadyLinked: 0,
    created: 0,
    errors: 0,
  };

  const digitalActors = await prisma.digitalActor.findMany({
    orderBy: { createdAt: "asc" },
  });
  stats.total = digitalActors.length;
  console.log(`Found ${stats.total} DigitalActor rows.\n`);

  for (const da of digitalActors) {
    const prefix = `[${da.id.slice(0, 8)}…] ${da.name}`;
    try {
      // 1. Already migrated?
      if (da.actorId) {
        console.log(`${prefix} — skip (already linked to Actor ${da.actorId})`);
        stats.alreadyLinked++;
        continue;
      }

      // 2. Voice-Check — Shows-Pipeline braucht einen voiceId. Wenn ein
      //    DigitalActor keinen direkten voiceId UND keinen libraryVoiceId
      //    hat, waere der resultierende Actor im Shows-System unbrauchbar.
      //    → wir legen ihn trotzdem an (damit Film-Pipeline ihn sieht),
      //    aber loggen die Warnung.
      const voiceId = da.voiceId ?? "";
      if (!voiceId && !da.libraryVoiceId) {
        console.log(`${prefix} — warn: no voiceId and no libraryVoiceId`);
      }

      // 3. Create new Actor (keine Duplicate-Merge-Logik — Admin kann
      //    spaeter im Library-UI mergen).
      const newId = `${slugify(da.name)}-${da.id.slice(-6)}`;
      if (!DRY) {
        // Some fields are required on Actor:
        //   - voiceId String (NOT NULL) — fallback "" if both sources empty
        //     (Shows-Pipeline will reject such actors until a voice is assigned)
        //   - voiceSettings Json (NOT NULL) — fallback {}
        //   - persona String (NOT NULL) — fallback ""
        //     (Shows-Pipeline prompts will be weak; UI should prompt admin
        //      to fill persona after migration)
        const fallbackVoiceId = voiceId || "";
        await prisma.$transaction(async (tx) => {
          await tx.actor.create({
            data: {
              id: newId,
              displayName: da.name,
              description: da.description ?? null,
              voiceProvider: "elevenlabs",
              voiceId: fallbackVoiceId,
              voiceSettings: (da.voiceSettings ?? {}) as object,
              voiceDescription: da.voiceDescription ?? null,
              libraryVoiceId: da.libraryVoiceId ?? null,
              persona: "", // Admin must fill via UI
              ageStyles: Prisma.JsonNull,
              // Video-Felder direkt aus DigitalActor
              characterSheet: (da.characterSheet ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
              outfit: da.outfit ?? null,
              traits: da.traits ?? null,
              style: da.style ?? null,
              tags: da.tags ?? [],
              portraitAssetId: da.portraitAssetId ?? null,
              // Scope: User-owned (nicht system-global, weil DigitalActors
              // historisch immer user-scoped waren)
              ownerUserId: da.userId,
            },
          });
          await tx.digitalActor.update({
            where: { id: da.id },
            data: { actorId: newId },
          });
        });
      }
      console.log(`${prefix} → created Actor '${newId}'`);
      stats.created++;
    } catch (e) {
      console.error(`${prefix} — ERROR:`, e instanceof Error ? e.message : e);
      stats.errors++;
    }
  }

  console.log("\n=== Stats ===");
  console.log(`Total DigitalActors:    ${stats.total}`);
  console.log(`Already linked (skip):  ${stats.alreadyLinked}`);
  console.log(`Created new Actor:      ${stats.created}`);
  console.log(`Errors:                 ${stats.errors}`);
  if (DRY) console.log("\n(DRY RUN — no DB writes performed)");
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
