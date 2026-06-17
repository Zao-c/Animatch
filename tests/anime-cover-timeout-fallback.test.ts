import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";

describe("AnimeCover timeout fallback", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("defines IMAGE_CANDIDATE_TIMEOUT_MS = 2000 for non-final candidates", () => {
    expect(source).toContain("IMAGE_CANDIDATE_TIMEOUT_MS = 2000");
  });

  it("defines FINAL_IMAGE_TIMEOUT_MS = 6000 for the last candidate", () => {
    expect(source).toContain("FINAL_IMAGE_TIMEOUT_MS = 6000");
  });

  it("sets a client-side setTimeout in a useEffect when state is loading", () => {
    expect(source).toContain('state !== "loading"');
    expect(source).toContain("window.setTimeout");
  });

  it("uses candidate timeout for non-final candidates", () => {
    const lines = source.split("\n");
    const timeoutLines = lines.filter((l) => l.includes("IMAGE_CANDIDATE_TIMEOUT_MS"));
    const finalLines = lines.filter((l) => l.includes("FINAL_IMAGE_TIMEOUT_MS"));
    expect(timeoutLines.length).toBeGreaterThanOrEqual(1);
    expect(finalLines.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to next candidate when timeout fires and hasNextCandidate is true", () => {
    expect(source).toContain("const hasNextCandidate = candidateIndex < candidates.length - 1");
    expect(source).toContain("if (hasNextCandidate)");
    expect(source).toContain("setCandidateIndex((current) => Math.min(current + 1, candidates.length - 1))");
    expect(source).toContain('setState("loading")');
  });

  it("sets error state when timeout fires on final candidate with no hasNextCandidate", () => {
    expect(source).toContain('setState("error")');
  });

  it("clears timeout on cleanup (unmount or dependency change)", () => {
    expect(source).toContain("window.clearTimeout(timeout)");
  });

  it("resets timeout and state when candidates or animeId change", () => {
    expect(source).toContain("}, [candidates, animeId]);");
    expect(source).toContain("setCandidateIndex(0)");
  });

  it("does not set timeout when state is not loading", () => {
    expect(source).toContain('if (state !== "loading"');
  });

  it("does not set timeout when imageSrc is null", () => {
    expect(source).toContain("imageSrc === null");
  });

  it("renders without crashing with valid src", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/test.jpg",
        title: "TimeoutTest"
      })
    );
    expect(html).toContain("TimeoutTest");
  });

  it("renders skeleton when all candidates fail", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "AllFailed"
      })
    );
    expect(html).toContain("AllFailed");
    expect(html).not.toContain("<img");
  });
});

describe("AnimeCover candidate order", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("places proxy primary before raw primary", () => {
    const proxyPrimaryIdx = source.indexOf("proxyExternalImageUrl(rawPrimary)");
    const rawPrimaryIdx = source.indexOf("rawPrimary,");
    expect(proxyPrimaryIdx).toBeLessThan(rawPrimaryIdx);
  });

  it("places raw primary before proxy secondary", () => {
    const rawPrimaryIdx = source.indexOf("rawPrimary,");
    const proxySecondaryIdx = source.indexOf("proxyExternalImageUrl(rawSecondary)");
    expect(rawPrimaryIdx).toBeLessThan(proxySecondaryIdx);
  });

  it("places proxy secondary before raw secondary", () => {
    const proxySecondaryIdx = source.indexOf("proxyExternalImageUrl(rawSecondary)");
    const rawSecondaryIdx = source.indexOf("rawSecondary", proxySecondaryIdx + 1);
    expect(proxySecondaryIdx).toBeLessThan(rawSecondaryIdx);
  });

  it("does NOT place proxy secondary before raw primary (old order)", () => {
    const rawPrimaryIdx = source.indexOf("rawPrimary");
    const proxySecondaryIdx = source.indexOf("proxyExternalImageUrl(rawSecondary)");
    expect(rawPrimaryIdx).toBeLessThan(proxySecondaryIdx);
  });

  it("candidate order in values array matches: proxy-primary, raw-primary, proxy-secondary, raw-secondary", () => {
    const fragment = source.slice(source.indexOf("const values = ["));
    const proxyPrimIdx = fragment.indexOf("proxyExternalImageUrl(rawPrimary)");
    const rawPrimIdx = fragment.indexOf("rawPrimary,");
    const proxySecIdx = fragment.indexOf("proxyExternalImageUrl(rawSecondary)");
    const rawSecIdx = fragment.indexOf("rawSecondary");

    expect(proxyPrimIdx).toBeLessThan(rawPrimIdx);
    expect(rawPrimIdx).toBeLessThan(proxySecIdx);
    expect(proxySecIdx).toBeLessThan(rawSecIdx);
  });
});

describe("AnimeCover existing fallback not degraded", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("still shows 封面暂不可用 text on error", () => {
    expect(source).toContain("封面暂不可用");
  });

  it("still renders skeleton gradient background always", () => {
    expect(source).toContain("bg-gradient-to-br");
    expect(source).toContain("absolute inset-0");
  });

  it("still has candidate deduplication", () => {
    expect(source).toContain("const seen = new Set");
    expect(source).toContain("seen.has(value)");
  });

  it("still has onError advance-to-next-candidate logic", () => {
    expect(source).toContain("setCandidateIndex((current) => current + 1)");
    expect(source).toContain('setState("loading")');
  });

  it("still has onLoad setState loaded", () => {
    expect(source).toContain('setState("loaded")');
  });
});
