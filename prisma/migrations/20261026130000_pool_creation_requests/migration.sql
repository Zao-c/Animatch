CREATE TABLE "PoolCreationRequest" (
  "userId" TEXT NOT NULL,
  "clientMutationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "poolId" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolCreationRequest_pkey" PRIMARY KEY ("userId", "clientMutationId")
);
CREATE INDEX "PoolCreationRequest_poolId_idx" ON "PoolCreationRequest"("poolId");
