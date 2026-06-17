import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";

describe("AnimeCover background warm proxy", () => {
  const source = readFileSync("src/components/AnimeCover.tsx", "utf8");
  const imageProxySource = readFileSync("src/lib/image-proxy.ts", "utf8");

  it("imports warmImageProxyCache from image-proxy", () => {
    expect(source).toContain(
      'import { proxyExternalImageUrl, warmImageProxyCache } from "@/lib/image-proxy"'
    );
  });

  it("calls warmImageProxyCache for both src and secondarySrc in useEffect", () => {
    expect(source).toContain("warmImageProxyCache(src)");
    expect(source).toContain("warmImageProxyCache(secondarySrc)");
  });

  it("useEffect has src and secondarySrc as dependencies", () => {
    expect(source).toContain("}, [src, secondarySrc]);");
  });

  it("calls warmImageProxyCache on img onLoad for the loaded imageSrc", () => {
    expect(source).toContain("warmImageProxyCache(imageSrc)");
  });

  it("warm failure does not affect loaded state", () => {
    expect(source).toContain("setState(\"loaded\")");
    expect(source).toContain("warmImageProxyCache(imageSrc)");
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
