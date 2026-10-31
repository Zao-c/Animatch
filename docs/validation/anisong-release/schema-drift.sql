-- DropForeignKey
ALTER TABLE "AnimeCollection" DROP CONSTRAINT "AnimeCollection_finalPoolId_fkey";

-- DropForeignKey
ALTER TABLE "AnimeCollection" DROP CONSTRAINT "AnimeCollection_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "BattleSeasonArchive" DROP CONSTRAINT "BattleSeasonArchive_seasonId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionSource" DROP CONSTRAINT "CollectionSource_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionSource" DROP CONSTRAINT "CollectionSource_poolId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionSource" DROP CONSTRAINT "CollectionSource_seasonId_fkey";

-- AddForeignKey
ALTER TABLE "AnimeCollection" ADD CONSTRAINT "AnimeCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeCollection" ADD CONSTRAINT "AnimeCollection_finalPoolId_fkey" FOREIGN KEY ("finalPoolId") REFERENCES "CustomPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "AnimeCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BattleSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSeasonArchive" ADD CONSTRAINT "BattleSeasonArchive_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BattleSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
