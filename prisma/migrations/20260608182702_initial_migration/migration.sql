-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PersonalRunStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "PoolComparisonResult" AS ENUM ('LEFT_WIN', 'RIGHT_WIN', 'DRAW', 'SKIP', 'LEFT_UNSEEN', 'RIGHT_UNSEEN', 'BOTH_UNSEEN');

-- CreateEnum
CREATE TYPE "PoolComparisonMode" AS ENUM ('NORMAL', 'RECALIBRATE', 'FOCUS_RECALIBRATE', 'RANGE_RECALIBRATE');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('UNKNOWN', 'UNSEEN', 'WATCHING', 'WATCHED', 'DROPPED', 'INTERESTED', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "RecommendationFeedback" AS ENUM ('NONE', 'INTERESTED', 'NOT_INTERESTED', 'WATCHED', 'ADDED_TO_POOL', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RecalibrationSessionType" AS ENUM ('SMART', 'RANGE', 'FOCUS');

-- CreateEnum
CREATE TYPE "RecalibrationSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "username" TEXT,
    "profileVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "allowTasteMatching" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anime" (
    "id" TEXT NOT NULL,
    "bgmId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleCn" TEXT,
    "summary" TEXT,
    "imageUrl" TEXT,
    "imageSmallUrl" TEXT,
    "imageMediumUrl" TEXT,
    "imageLargeUrl" TEXT,
    "airDate" TIMESTAMP(3),
    "bangumiRank" INTEGER,
    "bangumiScore" DOUBLE PRECISION,
    "bangumiVotes" INTEGER,
    "tags" TEXT[],
    "rawJson" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "imageStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "imageCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPool" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "PoolStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[],
    "sourcePoolId" TEXT,
    "affectsGlobalTaste" BOOLEAN NOT NULL DEFAULT true,
    "cloneCount" INTEGER NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolAnime" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    "initialElo" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolAnime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '默认榜单',
    "status" "PersonalRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'elo-v1',
    "pairingVersion" TEXT NOT NULL DEFAULT 'active-v1',
    "tierRuleVersion" TEXT NOT NULL DEFAULT 'percentile-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PersonalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPoolScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "eloScore" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "uncertainty" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "compareCount" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "lossCount" INTEGER NOT NULL DEFAULT 0,
    "drawCount" INTEGER NOT NULL DEFAULT 0,
    "unseenCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "manualTier" TEXT,
    "manualRank" INTEGER,
    "manualLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastComparedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPoolScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolComparison" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "leftAnimeId" TEXT NOT NULL,
    "rightAnimeId" TEXT NOT NULL,
    "winnerAnimeId" TEXT,
    "loserAnimeId" TEXT,
    "result" "PoolComparisonResult" NOT NULL,
    "mode" "PoolComparisonMode" NOT NULL DEFAULT 'NORMAL',
    "pairKey" TEXT NOT NULL,
    "isEffective" BOOLEAN NOT NULL DEFAULT true,
    "leftSeen" BOOLEAN,
    "rightSeen" BOOLEAN,
    "leftEloBefore" DOUBLE PRECISION,
    "leftEloAfter" DOUBLE PRECISION,
    "rightEloBefore" DOUBLE PRECISION,
    "rightEloAfter" DOUBLE PRECISION,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'elo-v1',
    "pairingVersion" TEXT NOT NULL DEFAULT 'active-v1',
    "tierRuleVersion" TEXT NOT NULL DEFAULT 'percentile-v1',
    "clientMutationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnimeStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "status" "WatchStatus" NOT NULL DEFAULT 'UNKNOWN',
    "unseenCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "firstMarkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMarkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnimeStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTierAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "fromTier" TEXT,
    "toTier" TEXT NOT NULL,
    "fromRank" INTEGER,
    "toRank" INTEGER,
    "eloScoreAtAdjustment" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTierAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTagPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT,
    "runId" TEXT,
    "tag" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTagPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasonJson" JSONB NOT NULL,
    "feedback" "RecommendationFeedback" NOT NULL DEFAULT 'NONE',
    "source" TEXT NOT NULL DEFAULT 'MIXED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSimilarity" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "commonAnimeCount" INTEGER NOT NULL,
    "rankSimilarity" DOUBLE PRECISION,
    "tagSimilarity" DOUBLE PRECISION,
    "topAgreementAnimeIds" TEXT[],
    "topDisagreementAnimeIds" TEXT[],
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSimilarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecalibrationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "RecalibrationSessionType" NOT NULL,
    "status" "RecalibrationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetTier" TEXT,
    "targetAnimeIds" TEXT[],
    "plannedCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecalibrationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_bgmId_key" ON "Anime"("bgmId");

-- CreateIndex
CREATE INDEX "CustomPool_creatorId_idx" ON "CustomPool"("creatorId");

-- CreateIndex
CREATE INDEX "CustomPool_status_idx" ON "CustomPool"("status");

-- CreateIndex
CREATE INDEX "CustomPool_visibility_idx" ON "CustomPool"("visibility");

-- CreateIndex
CREATE INDEX "PoolAnime_poolId_idx" ON "PoolAnime"("poolId");

-- CreateIndex
CREATE INDEX "PoolAnime_animeId_idx" ON "PoolAnime"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolAnime_poolId_animeId_key" ON "PoolAnime"("poolId", "animeId");

-- CreateIndex
CREATE INDEX "PersonalRun_userId_poolId_idx" ON "PersonalRun"("userId", "poolId");

-- CreateIndex
CREATE INDEX "PersonalRun_poolId_idx" ON "PersonalRun"("poolId");

-- CreateIndex
CREATE INDEX "UserPoolScore_userId_poolId_runId_idx" ON "UserPoolScore"("userId", "poolId", "runId");

-- CreateIndex
CREATE INDEX "UserPoolScore_animeId_idx" ON "UserPoolScore"("animeId");

-- CreateIndex
CREATE INDEX "UserPoolScore_poolId_runId_idx" ON "UserPoolScore"("poolId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPoolScore_userId_poolId_runId_animeId_key" ON "UserPoolScore"("userId", "poolId", "runId", "animeId");

-- CreateIndex
CREATE INDEX "PoolComparison_userId_poolId_runId_idx" ON "PoolComparison"("userId", "poolId", "runId");

-- CreateIndex
CREATE INDEX "PoolComparison_pairKey_idx" ON "PoolComparison"("pairKey");

-- CreateIndex
CREATE INDEX "PoolComparison_createdAt_idx" ON "PoolComparison"("createdAt");

-- CreateIndex
CREATE INDEX "PoolComparison_mode_idx" ON "PoolComparison"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "PoolComparison_userId_clientMutationId_key" ON "PoolComparison"("userId", "clientMutationId");

-- CreateIndex
CREATE INDEX "UserAnimeStatus_userId_idx" ON "UserAnimeStatus"("userId");

-- CreateIndex
CREATE INDEX "UserAnimeStatus_animeId_idx" ON "UserAnimeStatus"("animeId");

-- CreateIndex
CREATE INDEX "UserAnimeStatus_status_idx" ON "UserAnimeStatus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnimeStatus_userId_animeId_key" ON "UserAnimeStatus"("userId", "animeId");

-- CreateIndex
CREATE INDEX "ManualTierAdjustment_userId_poolId_runId_idx" ON "ManualTierAdjustment"("userId", "poolId", "runId");

-- CreateIndex
CREATE INDEX "ManualTierAdjustment_animeId_idx" ON "ManualTierAdjustment"("animeId");

-- CreateIndex
CREATE INDEX "UserTagPreference_userId_idx" ON "UserTagPreference"("userId");

-- CreateIndex
CREATE INDEX "UserTagPreference_tag_idx" ON "UserTagPreference"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "UserTagPreference_userId_poolId_runId_tag_key" ON "UserTagPreference"("userId", "poolId", "runId", "tag");

-- CreateIndex
CREATE INDEX "AnimeRecommendation_userId_idx" ON "AnimeRecommendation"("userId");

-- CreateIndex
CREATE INDEX "AnimeRecommendation_score_idx" ON "AnimeRecommendation"("score");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeRecommendation_userId_animeId_key" ON "AnimeRecommendation"("userId", "animeId");

-- CreateIndex
CREATE INDEX "UserSimilarity_userAId_idx" ON "UserSimilarity"("userAId");

-- CreateIndex
CREATE INDEX "UserSimilarity_userBId_idx" ON "UserSimilarity"("userBId");

-- CreateIndex
CREATE INDEX "UserSimilarity_similarityScore_idx" ON "UserSimilarity"("similarityScore");

-- CreateIndex
CREATE UNIQUE INDEX "UserSimilarity_userAId_userBId_scopeType_scopeId_key" ON "UserSimilarity"("userAId", "userBId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "RecalibrationSession_userId_poolId_runId_idx" ON "RecalibrationSession"("userId", "poolId", "runId");

-- CreateIndex
CREATE INDEX "RecalibrationSession_status_idx" ON "RecalibrationSession"("status");

-- AddForeignKey
ALTER TABLE "CustomPool" ADD CONSTRAINT "CustomPool_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPool" ADD CONSTRAINT "CustomPool_sourcePoolId_fkey" FOREIGN KEY ("sourcePoolId") REFERENCES "CustomPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolAnime" ADD CONSTRAINT "PoolAnime_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolAnime" ADD CONSTRAINT "PoolAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRun" ADD CONSTRAINT "PersonalRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRun" ADD CONSTRAINT "PersonalRun_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPoolScore" ADD CONSTRAINT "UserPoolScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPoolScore" ADD CONSTRAINT "UserPoolScore_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPoolScore" ADD CONSTRAINT "UserPoolScore_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PersonalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPoolScore" ADD CONSTRAINT "UserPoolScore_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PersonalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_leftAnimeId_fkey" FOREIGN KEY ("leftAnimeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_rightAnimeId_fkey" FOREIGN KEY ("rightAnimeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_winnerAnimeId_fkey" FOREIGN KEY ("winnerAnimeId") REFERENCES "Anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolComparison" ADD CONSTRAINT "PoolComparison_loserAnimeId_fkey" FOREIGN KEY ("loserAnimeId") REFERENCES "Anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnimeStatus" ADD CONSTRAINT "UserAnimeStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnimeStatus" ADD CONSTRAINT "UserAnimeStatus_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTierAdjustment" ADD CONSTRAINT "ManualTierAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTierAdjustment" ADD CONSTRAINT "ManualTierAdjustment_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTierAdjustment" ADD CONSTRAINT "ManualTierAdjustment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PersonalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTierAdjustment" ADD CONSTRAINT "ManualTierAdjustment_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTagPreference" ADD CONSTRAINT "UserTagPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTagPreference" ADD CONSTRAINT "UserTagPreference_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CustomPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTagPreference" ADD CONSTRAINT "UserTagPreference_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PersonalRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeRecommendation" ADD CONSTRAINT "AnimeRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeRecommendation" ADD CONSTRAINT "AnimeRecommendation_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSimilarity" ADD CONSTRAINT "UserSimilarity_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSimilarity" ADD CONSTRAINT "UserSimilarity_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
