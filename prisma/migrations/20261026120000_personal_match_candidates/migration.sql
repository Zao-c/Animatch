ALTER TABLE "PersonalRun" ADD COLUMN "matchExcludedAnimeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
