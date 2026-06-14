ALTER TABLE "CustomPool"
ADD COLUMN "allowPublicEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowCommunityMatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isOfficialDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CustomPool_isOfficialDemo_idx" ON "CustomPool"("isOfficialDemo");
CREATE INDEX "CustomPool_visibility_status_idx" ON "CustomPool"("visibility", "status");
