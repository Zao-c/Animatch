-- Add an idempotency key for season votes so retries and double submissions
-- do not advance BattleVote step numbers twice.
ALTER TABLE "BattleVote" ADD COLUMN "clientMutationId" TEXT;

CREATE UNIQUE INDEX "BattleVote_seasonId_userId_clientMutationId_key"
ON "BattleVote"("seasonId", "userId", "clientMutationId");
