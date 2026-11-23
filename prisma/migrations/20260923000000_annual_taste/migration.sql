
ALTER TABLE "User" ADD COLUMN "tasteProfilePublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "allowTasteMatching" SET DEFAULT false;
-- Existing accounts have never opted into identifiable taste matching.
UPDATE "User" SET "allowTasteMatching" = false;
CREATE TABLE "AnimeCollection" (
 "id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "title" TEXT NOT NULL, "year" INTEGER NOT NULL,
 "finalPoolId" TEXT UNIQUE REFERENCES "CustomPool"("id") ON DELETE SET NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AnimeCollection_ownerId_updatedAt_idx" ON "AnimeCollection"("ownerId", "updatedAt");
CREATE TABLE "CollectionSource" (
 "id" TEXT PRIMARY KEY, "collectionId" TEXT NOT NULL REFERENCES "AnimeCollection"("id") ON DELETE CASCADE,
 "poolId" TEXT NOT NULL REFERENCES "CustomPool"("id") ON DELETE CASCADE,
 "seasonId" TEXT NOT NULL REFERENCES "BattleSeason"("id") ON DELETE CASCADE,
 "quarter" INTEGER NOT NULL CHECK ("quarter" BETWEEN 1 AND 4),
 "phase" TEXT NOT NULL CHECK ("phase" IN ('OPENING', 'ENDING')),
 UNIQUE ("collectionId", "quarter", "phase"), UNIQUE ("collectionId", "seasonId")
);
CREATE TABLE "BattleSeasonArchive" (
 "seasonId" TEXT PRIMARY KEY REFERENCES "BattleSeason"("id") ON DELETE CASCADE,
 "version" TEXT NOT NULL DEFAULT 'season-elo-v1',
 "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "payload" JSONB NOT NULL
);
