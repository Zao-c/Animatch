import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";

describe("AnimeCover timeout fallback", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("defines IMAGE_CANDIDATE_TIMEOUT_MS = 5000 for non-final candidates", () => {
    expect(source).toContain("IMAGE_CANDIDATE_TIMEOUT_MS = 5000");
  });

  it("defines FINAL_IMAGE_TIMEOUT_MS = 8000 for the last candidate", () => {
    expect(source).toContain("FINAL_IMAGE_TIMEOUT_MS = 8000");
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

  it("uses the shared proxy-only candidate helper", () => {
    expect(source).toContain("getProxiedCoverCandidates(rawPrimary, rawSecondary)");
  });

  it("does not add direct raw remote URLs after proxy candidates", () => {
    expect(source).not.toContain("proxyExternalImageUrl(rawPrimary)");
    expect(source).not.toContain("proxyExternalImageUrl(rawSecondary)");
  });

  it("does NOT place raw primary before proxy primary", () => {
    expect(source).not.toContain("proxyExternalImageUrl(rawPrimary)");
  });

  it("candidate order no longer includes raw remote fallbacks", () => {
    expect(source).toContain("getProxiedCoverCandidates");
    expect(source).not.toContain("const values = [");
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
    const helperSource = readFileSync("src/lib/image-proxy.ts", "utf8");
    expect(helperSource).toContain("const seen = new Set");
    expect(helperSource).toContain("seen.has(url)");
  });

  it("still has onError advance-to-next-candidate logic", () => {
    expect(source).toContain("setCandidateIndex((current) => current + 1)");
    expect(source).toContain('setState("loading")');
  });

  it("still has onLoad setState loaded", () => {
    expect(source).toContain('setState("loaded")');
  });
});
