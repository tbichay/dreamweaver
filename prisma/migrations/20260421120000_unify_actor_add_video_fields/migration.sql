-- Unification Phase 1: Actor bekommt Video-Felder + Voice-Library-Link.
-- Non-destruktiv: alle Felder optional, bestehende Shows-Actors laufen unveraendert.
--
-- Zweck siehe schema.prisma (Kommentare an Actor + DigitalActor).

-- Actor: Video-Appearance
ALTER TABLE "Actor" ADD COLUMN "characterSheet" JSONB;
ALTER TABLE "Actor" ADD COLUMN "outfit" TEXT;
ALTER TABLE "Actor" ADD COLUMN "traits" TEXT;
ALTER TABLE "Actor" ADD COLUMN "style" TEXT;
ALTER TABLE "Actor" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Actor" ADD COLUMN "portraitAssetId" TEXT;

-- Actor: Voice-Library-Link (optional)
ALTER TABLE "Actor" ADD COLUMN "libraryVoiceId" TEXT;
ALTER TABLE "Actor" ADD COLUMN "voiceDescription" TEXT;
ALTER TABLE "Actor"
  ADD CONSTRAINT "Actor_libraryVoiceId_fkey"
  FOREIGN KEY ("libraryVoiceId") REFERENCES "Voice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Actor_libraryVoiceId_idx" ON "Actor"("libraryVoiceId");

-- DigitalActor: Schatten-Link auf Actor (wird von Data-Migration Phase 2 gesetzt)
-- Kein UNIQUE — mehrere DigitalActor-Duplikate (historische Test-Runs mit
-- gleichem Namen) sollen auf denselben Unified-Actor zeigen koennen.
ALTER TABLE "DigitalActor" ADD COLUMN "actorId" TEXT;
ALTER TABLE "DigitalActor"
  ADD CONSTRAINT "DigitalActor_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Actor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DigitalActor_actorId_idx" ON "DigitalActor"("actorId");
