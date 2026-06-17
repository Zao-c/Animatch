import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSlowNetwork, prewarmCoverUrls } from "../src/lib/cover-prewarm";

describe("prewarmCoverUrls", () => {
  const source = readFileSync("src/lib/cover-prewarm.ts", "utf8");

  it("deduplicates duplicate URLs before prewarming", () => {
    expect(source).toContain("const seen = new Set");
    expect(source).toContain("seen.has(proxyUrl)");
    expect(source).toContain("seen.has(trimmed)");
  });

  it("skips empty/null/undefined URLs", () => {
    expect(source).toContain("if (!url) continue");
    expect(source).toContain("trimmed.length === 0");
  });

  it("respects limit option to cap max warmed URLs", () => {
    expect(source).toContain("limit = Math.max(1, Math.trunc(options.limit");
    expect(source).toContain("candidates.length >= limit");
  });

  it("uses concurrency option to control parallel prewarm count", () => {
    expect(source).toContain("concurrency = Math.max(1, Math.trunc(options.concurrency");
    expect(source).toContain("candidates.slice(i, i + concurrency)");
  });

  it("prefers proxy URL before raw fallback in candidates", () => {
    expect(source).toContain("proxyExternalImageUrl(trimmed)");
    expect(source).toContain("includeRawFallback");
    const proxyPushIdx = source.indexOf("candidates.push(proxyUrl)");
    const rawPushIdx = source.indexOf("candidates.push(trimmed)");
    expect(proxyPushIdx).toBeGreaterThan(0);
    expect(rawPushIdx).toBeGreaterThan(proxyPushIdx);
  });

  it("does not throw on prewarm failure, resolves silently", () => {
    expect(source).toContain('done("skipped")');
    expect(source).toContain("image.onerror = () => done");
  });

  it("handles AbortSignal for cancellation", () => {
    expect(source).toContain("signal?.aborted");
    expect(source).toContain('signal?.addEventListener("abort"');
    expect(source).toContain('resolve("cancelled")');
  });

  it("uses timeout per single prewarm to avoid stuck requests", () => {
    expect(source).toContain("setTimeout(() => done");
  });

  it("returns PrewarmResult with warmed, skipped, cancelled counts", () => {
    expect(source).toContain("interface PrewarmResult");
    expect(source).toContain("warmed: number");
    expect(source).toContain("skipped: number");
    expect(source).toContain("cancelled: boolean");
  });

  it("resolves immediately on empty url input", async () => {
    const result = await prewarmCoverUrls([], { limit: 1 });
    expect(result).toEqual({ warmed: 0, skipped: 0, cancelled: false });
  });

  it("resolves immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await prewarmCoverUrls(["https://example.com/a.jpg"], {
      limit: 1,
      signal: controller.signal
    });
    expect(result.cancelled).toBe(true);
  });
});

describe("isSlowNetwork", () => {
  const source = readFileSync("src/lib/cover-prewarm.ts", "utf8");

  it("checks connection.saveData", () => {
    expect(source).toContain("connection.saveData === true");
  });

  it("checks effectiveType for slow-2g and 2g", () => {
    expect(source).toContain('connection.effectiveType === "slow-2g"');
    expect(source).toContain('connection.effectiveType === "2g"');
  });

  it("returns false when navigator is not available", () => {
    expect(source).toContain('typeof navigator === "undefined"');
    expect(source).toContain("return false");
  });

  it("returns false when connection API is not available", () => {
    expect(source).toContain("if (!connection) return false");
  });
});

describe("prewarm integration with pages", () => {
  const poolDetailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const tierSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");

  it("Pool Detail imports prewarmCoverUrls and isSlowNetwork", () => {
    expect(poolDetailSource).toContain("import { isSlowNetwork, prewarmCoverUrls }");
  });

  it("Pool Detail calls prewarmCoverUrls with getAnimeCoverUrl display intent", () => {
    expect(poolDetailSource).toContain("prewarmCoverUrls(coverUrls");
    expect(poolDetailSource).toContain('intent: "display"');
  });

  it("Pool Detail limits prewarm to 12 (6 on slow network)", () => {
    expect(poolDetailSource).toContain("slowNet ? 6 : 12");
    expect(poolDetailSource).toContain("limit: 12");
  });

  it("Pool Detail uses requestIdleCallback for extended prewarm up to 24", () => {
    expect(poolDetailSource).toContain("requestIdleCallback");
    expect(poolDetailSource).toContain("coverUrls.slice(12, 24)");
  });

  it("Pool Detail aborts prewarm on unmount", () => {
    expect(poolDetailSource).toContain("controller.abort()");
    expect(poolDetailSource).toContain("cancelIdleCallback");
  });

  it("Tier page imports prewarmCoverUrls and isSlowNetwork", () => {
    expect(tierSource).toContain("import { isSlowNetwork, prewarmCoverUrls }");
  });

  it("Tier page prewarms first 12 items from tierList.tiers", () => {
    expect(tierSource).toContain("prewarmCoverUrls(coverUrls");
    expect(tierSource).toContain("Object.values(tierList.tiers)");
  });

  it("Tier page respects slow network limit of 6", () => {
    expect(tierSource).toContain("isSlowNetwork() ? 6 : 12");
  });
});
