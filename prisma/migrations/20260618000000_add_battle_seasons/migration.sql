-- CreateEnum
CREATE TYPE "BattleSeasonMode" AS ENUM ('CLASSIC', 'BIAS');
CREATE TYPE "BattleSeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');
CREATE TYPE "BattleVoteType" AS ENUM ('NORMAL', 'BIAS');

-- CreateTable
CREATE TABLE "BattleSeason" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" "BattleSeasonMode" NOT NULL DEFAULT 'CLASSIC',
    "status" "BattleSeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "maxVotesPerUser" INTEGER NOT NULL DEFAULT 50,
    "maxVotesPerUserPerDay" INTEGER,
    "biasVotesPerUser" INTEGER NOT NULL DEFAULT 3,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleVote" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leftAnimeId" TEXT NOT NULL,
    "rightAnimeId" TEXT NOT NULL,
    "winnerAnimeId" TEXT NOT NULL,
    "loserAnimeId" TEXT NOT NULL,
    "voteType" "BattleVoteType" NOT NULL DEFAULT 'NORMAL',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "stepNumber" INTEGER NOT NULL,
    "beforeWinnerScore" INTEGER NOT NULL DEFAULT 0,
    "afterWinnerScore" INTEGER NOT NULL DEFAULT 0,
    "beforeLoserScore" INTEGER NOT NULL DEFAULT 0,
    "afterLoserScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BattleVote_seasonId_userId_stepNumber_key" ON "BattleVote"("seasonId", "userId", "stepNumber");
CREATE INDEX "BattleVote_seasonId_userId_idx" ON "BattleVote"("seasonId", "userId");
CREATE INDEX "BattleVote_seasonId_createdAt_idx" ON "BattleVote"("seasonId", "createdAt");
CREATE INDEX "BattleVote_poolId_idx" ON "BattleVote"("poolId");
CREATE INDEX "BattleSeason_poolId_idx" ON "BattleSeason"("poolId");
CREATE INDEX "BattleSeason_status_idx" ON "BattleSeason"("status");
CREATE INDEX "BattleSeason_createdByUserId_idx" ON "BattleSeason"("createdByUserId");

-- AddForeignKey
ALTER TABLE "BattleSeason" ADD CONSTRAINT "BattleSeason_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleSeason" ADD CONSTRAINT "BattleSeason_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleVote" ADD CONSTRAINT "BattleVote_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BattleSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleVote" ADD CONSTRAINT "BattleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
