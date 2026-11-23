CREATE TABLE "AwardCeremony" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "deadline" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "awards" JSONB NOT NULL,
  "shortlist" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AwardCeremony_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AwardCeremony_status_check" CHECK ("status" IN ('OPEN', 'FROZEN', 'PUBLISHED'))
);
CREATE TABLE "AwardBallot" (
  "id" TEXT NOT NULL,
  "ceremonyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "draft" JSONB NOT NULL,
  "submitted" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "submittedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AwardBallot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AwardCeremony_ownerId_createdAt_idx" ON "AwardCeremony"("ownerId", "createdAt");
CREATE UNIQUE INDEX "AwardBallot_ceremonyId_userId_key" ON "AwardBallot"("ceremonyId", "userId");
CREATE INDEX "AwardBallot_userId_idx" ON "AwardBallot"("userId");
ALTER TABLE "AwardCeremony" ADD CONSTRAINT "AwardCeremony_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AwardBallot" ADD CONSTRAINT "AwardBallot_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "AwardCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AwardBallot" ADD CONSTRAINT "AwardBallot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
