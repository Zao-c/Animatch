import { describe, it, expect } from "vitest";
import { proxyExternalImageUrl, isProxiedUrl } from "../src/lib/image-proxy";

describe("proxyExternalImageUrl", () => {
  it("returns null for null", () => {
    expect(proxyExternalImageUrl(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(proxyExternalImageUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(proxyExternalImageUrl("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(proxyExternalImageUrl("   ")).toBeNull();
  });

  it("does not wrap relative path starting with /", () => {
    expect(proxyExternalImageUrl("/images/hero.png")).toBe("/images/hero.png");
  });

  it("does not wrap data:image URL", () => {
    expect(proxyExternalImageUrl("data:image/png;base64,abc123"))
      .toBe("data:image/png;base64,abc123");
  });

  it("does not double-wrap already proxied URL", () => {
    const alreadyProxied = "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimg.jpg";
    expect(proxyExternalImageUrl(alreadyProxied)).toBe(alreadyProxied);
  });

  it("wraps external https URL", () => {
    const url = "https://lain.bgm.tv/pic/cover/l/12/34/5678.jpg";
    const result = proxyExternalImageUrl(url);
    expect(result).toBe("/api/image-proxy?url=" + encodeURIComponent(url));
  });

  it("wraps external http URL", () => {
    const url = "http://example.com/image.png";
    const result = proxyExternalImageUrl(url);
    expect(result).toBe("/api/image-proxy?url=" + encodeURIComponent(url));
  });

  it("does not produce undefined in URL", () => {
    const url = "https://example.com/img.jpg";
    const result = proxyExternalImageUrl(url);
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("null");
  });

  it("does not produce empty url parameter value", () => {
    const url = "https://example.com/img.jpg";
    const result = proxyExternalImageUrl(url);
    expect(result).not.toContain("?url=&");
    expect(result).not.toMatch(/\?url=$/);
  });

  it("trims whitespace from URL", () => {
    const url = " https://example.com/img.jpg ";
    const result = proxyExternalImageUrl(url);
    expect(result).toBe("/api/image-proxy?url=" + encodeURIComponent("https://example.com/img.jpg"));
  });
});

describe("isProxiedUrl", () => {
  it("returns true for proxied URLs", () => {
    expect(isProxiedUrl("/api/image-proxy?url=test")).toBe(true);
  });

  it("returns false for external URLs", () => {
    expect(isProxiedUrl("https://example.com/img.jpg")).toBe(false);
  });

  it("returns false for relative URLs", () => {
    expect(isProxiedUrl("/uploads/custom-items/x.jpg")).toBe(false);
  });
});
