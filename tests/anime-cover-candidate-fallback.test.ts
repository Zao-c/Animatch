import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";

describe("AnimeCover candidate priority queue", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("builds candidate queue: proxy primary before raw primary", () => {
    expect(source).toContain("proxyExternalImageUrl(rawPrimary)");
    const candidateArray = source.slice(source.indexOf("const values = ["));
    const proxyIdx = candidateArray.indexOf("proxyExternalImageUrl(rawPrimary)");
    const rawPrimaryIdx = candidateArray.indexOf("rawPrimary,");
    expect(proxyIdx).toBeLessThan(rawPrimaryIdx);
  });

  it("builds candidate queue: proxy secondary before raw secondary", () => {
    const candidateArray = source.slice(source.indexOf("const values = ["));
    const proxySecIdx = candidateArray.indexOf("proxyExternalImageUrl(rawSecondary)");
    const rawSecIdx = candidateArray.indexOf("rawSecondary", proxySecIdx + 1);
    expect(proxySecIdx).toBeLessThan(rawSecIdx);
  });

  it("deduplicates candidate URLs", () => {
    expect(source).toContain("const seen = new Set");
    expect(source).toContain("if (seen.has(value)) return []");
  });

  it("resets state on src change via useEffect dependency array", () => {
    expect(source).toContain("}, [candidates, animeId]);");
    expect(source).toContain("setCandidateIndex(0)");
    expect(source).toContain('candidates.length > 0 ? "loading" : "empty"');
  });

  it("advances to next candidate on img error within range", () => {
    expect(source).toContain("candidateIndex < candidates.length - 1");
    expect(source).toContain("setCandidateIndex((current) => current + 1)");
  });

  it("shows error state when all candidates exhausted", () => {
    expect(source).toContain("setState(\"error\")");
  });

  it("shows fallback title when cover state is error or empty", () => {
    expect(source).toContain("封面暂不可用");
    expect(source).toContain('coverState === "error" || coverState === "empty"');
  });

  it("always has skeleton layer with background gradient", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        title: "测试"
      })
    );
    expect(html).toContain("bg-gradient-to-br");
    expect(html).toContain("absolute inset-0");
  });

  it("never returns empty div without skeleton", () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "无封面"
      })
    );
    expect(emptyHtml).toContain("<div");
    expect(emptyHtml).toContain("无");
  });

  it("renders proxy URL as first img src and passes secondarySrc to data attr", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://primary.example/a.jpg",
        secondarySrc: "https://secondary.example/b.jpg",
        title: "Dual"
      })
    );
    expect(html).toContain("/api/image-proxy?url=https%3A%2F%2Fprimary.example");
    expect(html).toContain("data-export-secondary-src=\"https://secondary.example/b.jpg\"");
  });

  it("does not produce empty src attributes", () => {
    expect(source).toContain("const values = [");
    expect(source).toContain("const rawPrimary = normalizeImageUrl(primary)");
    expect(source).toContain("normalizeImageUrl");
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "Only Skeleton"
      })
    );
    expect(html).not.toContain('src=""');
  });

  it("proxyExternalImageUrl and warmImageProxyCache are imported from image-proxy", () => {
    expect(source).toContain("proxyExternalImageUrl");
    expect(source).toContain('from "@/lib/image-proxy"');
  });
});
