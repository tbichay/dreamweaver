-- FokusTemplate.formatType: entscheidet ob der Episode-Generator die Show-
-- Framing als klassisches Hoerspiel ("narrative") oder als Non-Narrative-
-- Format (Meditation, Affirmation, Breathwork) rendert. Default "narrative"
-- damit alle existierenden FokusTemplates unveraendert weiterlaufen.
-- Re-seed setzt dann die korrekten Typen pro Template.
ALTER TABLE "FokusTemplate"
  ADD COLUMN "formatType" TEXT NOT NULL DEFAULT 'narrative';

-- Backfill der bekannten non-narrative Templates basierend auf FORMAT_TYPE_MAP
-- in prisma/seed-shows.ts. Wenn das Seeden der Template-Defs neu
-- ausgefuehrt wird, schreibt upsert die Werte nochmal drueber — der Backfill
-- hier schuetzt bloss Prod-DBs zwischen Migration und naechstem Seed-Lauf.
UPDATE "FokusTemplate" SET "formatType" = 'meditation' WHERE "id" IN ('meditation','traumreise','gutenacht');
UPDATE "FokusTemplate" SET "formatType" = 'affirmation' WHERE "id" = 'affirmation';
