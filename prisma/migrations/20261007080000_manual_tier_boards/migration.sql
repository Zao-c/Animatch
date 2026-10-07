CREATE TABLE "ManualTierBoard" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "poolId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "layout" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "shareToken" TEXT,
  "sharedSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualTierBoard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualTierBoard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ManualTierBoard_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualTierBoard_ownerId_poolId_key" ON "ManualTierBoard"("ownerId", "poolId");
CREATE UNIQUE INDEX "ManualTierBoard_shareToken_key" ON "ManualTierBoard"("shareToken");
