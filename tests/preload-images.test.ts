import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadImage } from "../src/lib/preload-images";

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    setTimeout(() => {
      if (value.includes("fail")) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 0);
  }
}

describe("preloadImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false for empty src", async () => {
    await expect(preloadImage(null)).resolves.toBe(false);
    await expect(preloadImage(undefined)).resolves.toBe(false);
    await expect(preloadImage("")).resolves.toBe(false);
  });

  it("resolves true on image load", async () => {
    vi.stubGlobal("Image", MockImage);

    await expect(preloadImage("https://img.example/ok.jpg")).resolves.toBe(true);
  });

  it("resolves false on image error", async () => {
    vi.stubGlobal("Image", MockImage);

    await expect(preloadImage("https://img.example/fail.jpg")).resolves.toBe(false);
  });
});
