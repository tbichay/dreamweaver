-- Actor.visualVariants: JSONB-Array fuer alternative Visual-Styles die durch
-- den Dedup-Merge-Endpoint eingesammelt werden. Default ist ein leeres Array,
-- damit existierende Actors unveraendert weiterlaufen.
ALTER TABLE "Actor"
  ADD COLUMN "visualVariants" JSONB NOT NULL DEFAULT '[]'::jsonb;
