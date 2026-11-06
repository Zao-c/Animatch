import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("uploaded cover art is mirrored to COS", () => {
  const serviceSource = readFileSync("src/lib/server/cos-cover-cache.ts", "utf8");
  const uploadHelperSource = readFileSync("src/lib/anime-cover-upload.ts", "utf8");
  const customItemsSource = readFileSync("src/app/api/pools/[poolId]/custom-items/route.ts", "utf8");
  const animeServiceSource = readFileSync("src/lib/anime-service.ts", "utf8");
  const scriptSource = readFileSync("scripts/cache-covers-to-cos.ts", "utf8");

  it("treats local upload paths as cacheable cover sources", () => {
    expect(serviceSource).toContain("export function pickCoverSource");
    expect(serviceSource).toContain("if (isLocalUploadPublicPath(value)) {");
    expect(serviceSource).toContain('return { kind: "local", publicPath: value };');
    expect(serviceSource).toContain("localUploadPublicPathToFilePath(source.publicPath)");
    expect(serviceSource).toContain("throw new Error(\"local upload is missing\")");
    expect(uploadHelperSource).toContain("export function localUploadPublicPathToFilePath");
    expect(uploadHelperSource).toContain("export function isLocalUploadPublicPath");
  });

  it("queues a COS copy after a custom item upload", () => {
    expect(customItemsSource).toContain(
      'import { enqueuePoolAnimeCoverCache } from "@/lib/server/pool-cover-cache";'
    );
    expect(customItemsSource).toContain("enqueuePoolAnimeCoverCache(createdEntry.anime);");
  });

  it("queues a COS copy after manual anime creation", () => {
    expect(animeServiceSource).toContain("cacheAnimeCoverToCosBackground(anime);");
  });

  it("lets the backfill script target uploaded items only", () => {
    expect(scriptSource).toContain('arg === "--source"');
    expect(scriptSource).toContain("const sourceFilter: { source?: AnimeSourceType } = {};");
    expect(scriptSource).toContain("const where = { ...(args.allLibrary ? {} : activePoolFilter), ...sourceFilter };");
    expect(scriptSource).toContain("const source = pickCoverSource(anime);");
  });
});
