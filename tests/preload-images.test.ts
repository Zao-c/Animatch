import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { preloadImage, preloadPairs } from "../src/lib/preload-images";

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

class HangingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    // Intentionally never calls load or error.
  }
}

class CountingImage {
  static assignedSources: string[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    CountingImage.assignedSources.push(value);
    setTimeout(() => this.onload?.(), 0);
  }
}

describe("preloadImage", () => {
  afterEach(() => {
    vi.useRealTimers();
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

  it("times out when the image never settles", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", HangingImage);

    const result = preloadImage("https://img.example/hang.jpg", { timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe(false);
  });

  it("coalesces concurrent loads for the same URL", async () => {
    CountingImage.assignedSources = [];
    vi.stubGlobal("Image", CountingImage);

    await Promise.all([
      preloadImage("https://img.example/shared.jpg"),
      preloadImage("https://img.example/shared.jpg")
    ]);

    expect(CountingImage.assignedSources).toEqual(["https://img.example/shared.jpg"]);
  });
});

describe("match preload priority", () => {
  const preloadSource = readFileSync("src/lib/preload-images.ts", "utf8");
  const matchSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("does not preload the first pair twice", () => {
    expect(preloadSource).not.toContain("firstPairRequired");
    expect(preloadSource).not.toContain("await preloadPair(targetPairs[0])");
  });

  it("warms future queue items in the background instead of competing with the first playable pair", () => {
    expect(matchSource).toContain("void preloadPairs(data.pairs.slice(1, 4), { preloadCount: 3 })");
    expect(matchSource).not.toContain("await preloadPairs(data.pairs.slice(0, 1)");
  });

  it("retains pair-level preload accounting", async () => {
    vi.stubGlobal("Image", MockImage);
    const result = await preloadPairs([], { preloadCount: 3 });
    expect(result).toEqual({ loaded: 0, total: 0 });
  });
});
