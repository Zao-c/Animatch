-- AlterTable
ALTER TABLE "BattleVote" ADD COLUMN "beforeWinnerElo" DOUBLE PRECISION;
ALTER TABLE "BattleVote" ADD COLUMN "afterWinnerElo" DOUBLE PRECISION;
ALTER TABLE "BattleVote" ADD COLUMN "beforeLoserElo" DOUBLE PRECISION;
ALTER TABLE "BattleVote" ADD COLUMN "afterLoserElo" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "BattleSeasonUserScore" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "eloScore" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "uncertainty" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "compareCount" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "lossCount" INTEGER NOT NULL DEFAULT 0,
    "biasWinCount" INTEGER NOT NULL DEFAULT 0,
    "unseenCount" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "lastVotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleSeasonUserScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BattleSeasonUserScore_seasonId_userId_animeId_key" ON "BattleSeasonUserScore"("seasonId", "userId", "animeId");
CREATE INDEX "BattleSeasonUserScore_seasonId_userId_idx" ON "BattleSeasonUserScore"("seasonId", "userId");
CREATE INDEX "BattleSeasonUserScore_seasonId_animeId_idx" ON "BattleSeasonUserScore"("seasonId", "animeId");
CREATE INDEX "BattleSeasonUserScore_poolId_idx" ON "BattleSeasonUserScore"("poolId");
CREATE INDEX "BattleSeasonUserScore_userId_idx" ON "BattleSeasonUserScore"("userId");
CREATE INDEX "BattleSeasonUserScore_animeId_idx" ON "BattleSeasonUserScore"("animeId");
CREATE INDEX "BattleSeasonUserScore_seasonId_eloScore_idx" ON "BattleSeasonUserScore"("seasonId", "eloScore");

-- AddForeignKey
ALTER TABLE "BattleSeasonUserScore" ADD CONSTRAINT "BattleSeasonUserScore_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BattleSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleSeasonUserScore" ADD CONSTRAINT "BattleSeasonUserScore_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleSeasonUserScore" ADD CONSTRAINT "BattleSeasonUserScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleSeasonUserScore" ADD CONSTRAINT "BattleSeasonUserScore_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
