CREATE TABLE "SongTemplate" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "sourceBoardId" TEXT,
  "title" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
  "document" JSONB NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SongTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SongTemplate_sourceBoardId_key" ON "SongTemplate"("sourceBoardId");
CREATE INDEX "SongTemplate_active_updatedAt_idx" ON "SongTemplate"("active", "updatedAt");
ALTER TABLE "SongTemplate" ADD CONSTRAINT "SongTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SongTemplate" ADD CONSTRAINT "SongTemplate_sourceBoardId_fkey" FOREIGN KEY ("sourceBoardId") REFERENCES "SongBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SongBoard" ADD COLUMN "templateId" TEXT, ADD COLUMN "templateRevision" INTEGER;
CREATE UNIQUE INDEX "SongBoard_ownerId_templateId_key" ON "SongBoard"("ownerId", "templateId");
ALTER TABLE "SongBoard" ADD CONSTRAINT "SongBoard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SongTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "SongAudioAsset" (
  "id" TEXT NOT NULL, "sha256" TEXT NOT NULL, "key" TEXT NOT NULL,
  "mime" TEXT NOT NULL, "bytes" INTEGER NOT NULL, "isPreview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SongAudioAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SongAudioAsset_sha256_key" ON "SongAudioAsset"("sha256");
CREATE UNIQUE INDEX "SongAudioAsset_key_key" ON "SongAudioAsset"("key");
