import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("uploaded cover art is mirrored to COS", () => {
  const serviceSource = readFileSync("src/lib/server/cos-cover-cache.ts", "utf8");
  const uploadHelperSource = readFileSync("src/lib/anime-cover-upload.ts", "utf8");
  const customItemsSource = readFileSync("src/app/api/pools/[poolId]/custom-items/route.ts", "utf8");
  const replaceImageSource = readFileSync(
    "src/app/api/pools/[poolId]/anime/[animeId]/image/route.ts",
    "utf8"
  );
  const animeServiceSource = readFileSync("src/lib/anime-service.ts", "utf8");
  const scriptSource = readFileSync("scripts/cache-covers-to-cos.ts", "utf8");
  const poolPageSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("treats local upload paths as cacheable cover sources", () => {
    expect(serviceSource).toContain("export function pickCoverSource");
    expect(serviceSource).toContain("if (isLocalUploadPublicPath(value)) {");
    expect(serviceSource).toContain('return { kind: "local", publicPath: value };');
    expect(serviceSource).toContain("localUploadPublicPathToFilePath(source.publicPath)");
    expect(serviceSource).toContain("throw new Error(\"local upload is missing\")");
    expect(uploadHelperSource).toContain("export function localUploadPublicPathToFilePath");
    expect(uploadHelperSource).toContain("export function isLocalUploadPublicPath");
  });

  it("keeps uploaded art at its original quality on the CDN", () => {
    expect(serviceSource).toContain("async function prepareCoverObject(source: CoverSource, downloaded: Buffer)");
    expect(serviceSource).toContain("if (source.kind === \"local\") {");
    expect(serviceSource).toContain("body: downloaded,");
    expect(serviceSource).toContain("const key = buildCoverKey(config.prefix, anime, sourceKey, contentHash, prepared.extension);");
    // Remote catalog covers are still downscaled to save bandwidth.
    expect(serviceSource).toContain(".webp({ quality: 82 })");
  });

  it("deletes the previous COS object when the key changes", () => {
    expect(serviceSource).toContain("if (previousKey !== null && previousKey !== key) {");
    expect(serviceSource).toContain("cos.deleteObject(");
    expect(serviceSource).toContain("export async function deleteAnimeCoverCosObject");
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

  it("replaces the stored artwork of an existing item instead of stacking a duplicate", () => {
    expect(replaceImageSource).toContain("saveCustomItemUpload({");
    expect(replaceImageSource).toContain("cachedCoverUrl: null");
    expect(replaceImageSource).toContain("await deleteLocalCustomItemIfPresent(anime.imageUrl);");
    expect(replaceImageSource).toContain("await deleteAnimeCoverCosObject(anime);");
    expect(replaceImageSource).toContain("enqueuePoolAnimeCoverCache(updatedAnime);");
    expect(replaceImageSource).toContain("coverUrlOverride: null");
    expect(poolPageSource).toContain("替换原图");
    expect(poolPageSource).toContain("await replacePoolAnimeImage(entry.poolId, entry.animeId, file);");
  });

  it("lets the backfill script target uploaded items only", () => {
    expect(scriptSource).toContain('arg === "--source"');
    expect(scriptSource).toContain("const sourceFilter: { source?: AnimeSourceType } = {};");
    expect(scriptSource).toContain("const where = { ...(args.allLibrary ? {} : activePoolFilter), ...sourceFilter };");
    expect(scriptSource).toContain("const source = pickCoverSource(anime);");
  });
});
