-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "recoveryExpiresAt" TIMESTAMP(3),
ADD COLUMN     "recoveryHash" TEXT;

-- AlterTable
ALTER TABLE "AwardCeremony" ADD COLUMN     "accessMode" TEXT NOT NULL DEFAULT 'LINK',
ADD COLUMN     "eligibility" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "merges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "nominationMode" TEXT NOT NULL DEFAULT 'ASSISTED',
ADD COLUMN     "publishedSnapshot" JSONB;

-- CreateTable
CREATE TABLE "AwardMember" (
    "ceremonyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardMember_pkey" PRIMARY KEY ("ceremonyId","userId")
);

-- CreateTable
CREATE TABLE "AwardStage" (
    "ceremonyId" TEXT NOT NULL,
    "awardId" TEXT,
    "scene" TEXT NOT NULL DEFAULT 'WAITING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardStage_pkey" PRIMARY KEY ("ceremonyId")
);

-- CreateTable
CREATE TABLE "AwardRound" (
    "id" TEXT NOT NULL,
    "ceremonyId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "candidates" JSONB NOT NULL,
    "tally" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "AwardRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardFinalVote" (
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "candidateKey" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardFinalVote_pkey" PRIMARY KEY ("roundId","userId")
);

-- CreateTable
CREATE TABLE "AwardDecision" (
    "id" TEXT NOT NULL,
    "ceremonyId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "winners" JSONB NOT NULL,
    "roundId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "AwardDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardEventLog" (
    "id" TEXT NOT NULL,
    "ceremonyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AwardMember_userId_idx" ON "AwardMember"("userId");

-- CreateIndex
CREATE INDEX "AwardRound_ceremonyId_status_idx" ON "AwardRound"("ceremonyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AwardRound_ceremonyId_awardId_number_key" ON "AwardRound"("ceremonyId", "awardId", "number");

-- CreateIndex
CREATE INDEX "AwardFinalVote_userId_idx" ON "AwardFinalVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AwardDecision_ceremonyId_awardId_key" ON "AwardDecision"("ceremonyId", "awardId");

-- CreateIndex
CREATE INDEX "AwardEventLog_ceremonyId_createdAt_idx" ON "AwardEventLog"("ceremonyId", "createdAt");

-- AddForeignKey
ALTER TABLE "AwardMember" ADD CONSTRAINT "AwardMember_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "AwardCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardMember" ADD CONSTRAINT "AwardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardStage" ADD CONSTRAINT "AwardStage_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "AwardCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardRound" ADD CONSTRAINT "AwardRound_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "AwardCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardFinalVote" ADD CONSTRAINT "AwardFinalVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "AwardRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardFinalVote" ADD CONSTRAINT "AwardFinalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardDecision" ADD CONSTRAINT "AwardDecision_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "AwardCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardEventLog" ADD CONSTRAINT "AwardEventLog_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "AwardCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

