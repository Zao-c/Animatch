-- CreateTable
CREATE TABLE "TierShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tierLabels" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TierShare_token_key" ON "TierShare"("token");

-- CreateIndex
CREATE INDEX "TierShare_poolId_idx" ON "TierShare"("poolId");

-- CreateIndex
CREATE INDEX "TierShare_runId_idx" ON "TierShare"("runId");

-- CreateIndex
CREATE INDEX "TierShare_createdAt_idx" ON "TierShare"("createdAt");

-- AddForeignKey
ALTER TABLE "TierShare" ADD CONSTRAINT "TierShare_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierShare" ADD CONSTRAINT "TierShare_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PersonalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
