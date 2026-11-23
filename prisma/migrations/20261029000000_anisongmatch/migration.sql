CREATE TABLE "SongBoard" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "document" JSONB NOT NULL,
  "shareToken" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SongBoard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SongBoard_shareToken_key" ON "SongBoard"("shareToken");
CREATE INDEX "SongBoard_ownerId_updatedAt_idx" ON "SongBoard"("ownerId", "updatedAt");
ALTER TABLE "SongBoard" ADD CONSTRAINT "SongBoard_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
