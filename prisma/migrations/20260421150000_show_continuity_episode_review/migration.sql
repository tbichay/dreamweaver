-- S3 (Pilot-Review) + Continuity-Mode + EpisodeTopics
-- Non-destruktiv: alle Felder haben sichere Defaults, bestehende Shows
-- laufen unveraendert (continuityMode=false, kein Review-Gate).
--
-- Zweck:
--   - Show.continuityMode/Depth: opt-in-Serialisierung von Episoden
--   - ShowEpisode.isPilot/reviewStatus/reviewedAt/reviewedBy/reviewNotes:
--     Admin-Review-Gate bevor der Canzoia-Webhook abgefeuert wird
--   - ShowEpisode.topics/continuityNotes: Feed-Forward fuer Folge-Episoden

-- ── Show: Continuity-Flags ─────────────────────────────────────────
ALTER TABLE "Show" ADD COLUMN "continuityMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Show" ADD COLUMN "continuityDepth" INTEGER NOT NULL DEFAULT 3;

-- ── ShowEpisode: Pilot + Review-Gate ───────────────────────────────
ALTER TABLE "ShowEpisode" ADD COLUMN "isPilot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShowEpisode" ADD COLUMN "reviewStatus" TEXT;
ALTER TABLE "ShowEpisode" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ShowEpisode" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ShowEpisode" ADD COLUMN "reviewNotes" TEXT;

-- ── ShowEpisode: Continuity-Output ─────────────────────────────────
ALTER TABLE "ShowEpisode" ADD COLUMN "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ShowEpisode" ADD COLUMN "continuityNotes" TEXT;

-- Index fuer "welche Episoden warten auf Review" Abfragen
CREATE INDEX "ShowEpisode_reviewStatus_idx" ON "ShowEpisode"("reviewStatus");
