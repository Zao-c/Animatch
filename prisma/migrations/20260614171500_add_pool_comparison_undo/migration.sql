-- Add append-only undo metadata for PoolComparison.
ALTER TABLE "PoolComparison" ADD COLUMN "undoneAt" TIMESTAMP(3);
ALTER TABLE "PoolComparison" ADD COLUMN "undoneByUserId" TEXT;

CREATE INDEX "PoolComparison_userId_poolId_runId_undoneAt_createdAt_idx"
  ON "PoolComparison"("userId", "poolId", "runId", "undoneAt", "createdAt");
