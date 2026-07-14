import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";

describe("AnimeCover background warm proxy", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");
  const imageProxySource = readFileSync("src/lib/image-proxy.ts", "utf8");

  it("imports warmImageProxyCache from image-proxy", () => {
    expect(source).toMatch(/import \{[^}]*getProxiedCoverCandidates[^}]*warmImageProxyCache[^}]*\} from "@\/lib\/image-proxy"/);
  });

  it("only warms both sources when a caller opts in", () => {
    expect(source).toContain("warm = false");
    expect(source).toContain("if (!warm) return;");
    expect(source).toContain("warmImageProxyCache(src)");
    expect(source).toContain("warmImageProxyCache(secondarySrc)");
  });

  it("uses lazy loading by default so lists do not fetch off-screen covers", () => {
    expect(source).toContain('loading = "lazy"');
    expect(source).toContain("loading={loading}");
  });

  it("uses bounded candidate and final image waits", () => {
    expect(source).toContain("IMAGE_CANDIDATE_TIMEOUT_MS = 5000");
    expect(source).toContain("FINAL_IMAGE_TIMEOUT_MS = 8000");
  });

  it("automatically retries failed cover candidates after a short delay", () => {
    expect(source).toContain("IMAGE_ERROR_RETRY_DELAY_MS = 2500");
    expect(source).toContain("IMAGE_ERROR_RETRY_LIMIT = 2");
    expect(source).toContain('state !== "error"');
    expect(source).toContain("setCandidateIndex(0)");
    expect(source).toContain('setState("loading")');
  });

  it("only warms a loaded candidate for opted-in hero covers", () => {
    expect(source).toContain("if (warm) warmImageProxyCache(imageSrc)");
  });

  it("warm failure does not affect loaded state", () => {
    expect(source).toContain("setState(\"loaded\")");
    expect(source).toContain("if (warm) warmImageProxyCache(imageSrc)");
  });

  it("does not warm for null/empty src", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "NoWarm"
      })
    );
    expect(html).toContain("NoWarm");
    expect(html).not.toContain("<img");
  });

  it("renders with remote src without crashing", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/warm-test.jpg",
        title: "WarmTest"
      })
    );
    expect(html).toContain("/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fwarm-test.jpg");
    expect(html).toContain("WarmTest");
  });
});

describe("warmImageProxyCache tool", () => {
  const source = readFileSync("src/lib/image-proxy.ts", "utf8");

  it("defines warmImageProxyCache as exported function", () => {
    expect(source).toContain("export function warmImageProxyCache");
  });

  it("returns early when not in browser (SSR safe)", () => {
    expect(source).toContain('typeof window === "undefined"');
    expect(source).toContain("return");
  });

  it("returns early when url is not a remote image", () => {
    expect(source).toContain("!isRemoteImageUrl(url)");
  });

  it("returns early when url already in warmedProxyUrls set", () => {
    expect(source).toContain("warmedProxyUrls.has(proxiedUrl)");
  });

  it("uses fetch with force-cache and same-origin credentials", () => {
    expect(source).toContain("fetch(proxiedUrl");
    expect(source).toContain('cache: "force-cache"');
    expect(source).toContain('credentials: "same-origin"');
  });

  it("catches fetch errors silently and resets dedup state", () => {
    expect(source).toContain(".catch(() => {");
    expect(source).toContain("warmedProxyUrls.delete(proxiedUrl)");
  });

  it("does not warm when proxiedUrl equals original URL", () => {
    expect(source).toContain("proxiedUrl === url");
  });

  it("returns early when proxiedUrl is null", () => {
    expect(source).toContain("proxiedUrl === null");
  });

  it("schedules fetch with setTimeout 0 to avoid blocking render", () => {
    expect(source).toContain("window.setTimeout");
    expect(source).toContain("}, 0);");
  });
});
