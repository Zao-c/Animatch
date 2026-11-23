import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  coverCrop,
  generateSmartCover,
  measureAlphaRegion
} from "../src/lib/server/smart-cover-thumbnail";

describe("smart cover composition", () => {
  it("trims transparent borders but keeps opaque pixels", () => {
    const width = 100;
    const height = 80;
    const data = new Uint8Array(width * height * 4);
    for (let y = 15; y < 65; y++) {
      for (let x = 35; x < 65; x++) data[(y * width + x) * 4 + 3] = 255;
    }
    const region = measureAlphaRegion(data, width, height);
    expect(region.bounds.left).toBeGreaterThan(0);
    expect(region.bounds.top).toBeGreaterThan(0);
    expect(region.bounds.width).toBeLessThan(width);
    expect(region.bounds.height).toBeLessThan(height);
    expect(region.focusX).toBeCloseTo(0.5, 1);
    expect(region.focusY).toBeCloseTo(0.5, 1);
  });

  it("chooses an aspect-correct focal crop for wide artwork", () => {
    const crop = coverCrop({ left: 0, top: 0, width: 2048, height: 1024 }, 2 / 3, 990, 510);
    expect(crop.height).toBe(1024);
    expect(crop.width).toBeGreaterThanOrEqual(682);
    expect(crop.width).toBeLessThanOrEqual(683);
    expect(crop.left).toBeGreaterThan(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(2048);
  });

  it("generates separate 2:3 and square cached-ready WebP covers", async () => {
    const width = 512, height = 256;
    const rgba = Buffer.alloc(width * height * 4);
    // A centered red character on a transparent 2:1 canvas.
    for (let y = 20; y < 236; y++) {
      for (let x = 193; x < 319; x++) {
        const offset = (y * width + x) * 4;
        rgba[offset] = 230;
        rgba[offset + 1] = 30;
        rgba[offset + 2] = 40;
        rgba[offset + 3] = 255;
      }
    }
    const source = await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png().toBuffer();
    for (const [kind, expectedWidth, expectedHeight] of [
      ["card", 320, 480], ["tier", 256, 256], ["match", 768, 1152]
    ] as const) {
      const result = await generateSmartCover(source, kind);
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(expectedWidth);
      expect(metadata.height).toBe(expectedHeight);
      const center = await sharp(result)
        .extract({ left: Math.floor(expectedWidth / 2), top: Math.floor(expectedHeight / 2), width: 1, height: 1 })
        .raw().toBuffer();
      expect(center[0]).toBeGreaterThan(150);
      expect(center[1]).toBeLessThan(90);
    }
  });

  it("rejects formats that could trigger unbounded rasterisation", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>'
    );
    await expect(generateSmartCover(svg, "card")).rejects.toThrow("Unsupported image format");
  });
});
