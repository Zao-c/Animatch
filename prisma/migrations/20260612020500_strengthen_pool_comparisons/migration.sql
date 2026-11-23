-- AlterTable
ALTER TABLE "PoolComparison" ADD COLUMN "leftPosition" INTEGER;
ALTER TABLE "PoolComparison" ADD COLUMN "rightPosition" INTEGER;
ALTER TABLE "PoolComparison" ADD COLUMN "leftKFactor" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "rightKFactor" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "expectedLeft" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "expectedRight" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "deltaLeft" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "deltaRight" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "leftScore10Before" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "leftScore10After" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "rightScore10Before" DOUBLE PRECISION;
ALTER TABLE "PoolComparison" ADD COLUMN "rightScore10After" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "PoolComparison_poolId_runId_createdAt_idx" ON "PoolComparison"("poolId", "runId", "createdAt");
CREATE INDEX "PoolComparison_userId_poolId_runId_createdAt_idx" ON "PoolComparison"("userId", "poolId", "runId", "createdAt");
CREATE INDEX "PoolComparison_leftAnimeId_idx" ON "PoolComparison"("leftAnimeId");
CREATE INDEX "PoolComparison_rightAnimeId_idx" ON "PoolComparison"("rightAnimeId");
