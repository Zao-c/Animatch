import { afterEach, describe, expect, it, vi } from "vitest";
import { toPng } from "html-to-image";
import { exportShareCardAsPng, getExportPixelRatio, inlineShareCardImagesForExport, waitForShareCardImages } from "../src/lib/share-export";

const PNG = `data:image/png;base64,${"a".repeat(128)}`;
vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function fakeImage(src = "https://cdn.example.test/cover.png") {
  return {
    src, currentSrc: "", complete: true, naturalWidth: 100, naturalHeight: 100,
    dataset: {} as DOMStringMap, style: {} as CSSStyleDeclaration,
    removeAttribute: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn()
  } as unknown as HTMLImageElement;
}
function fakeCard(images: HTMLImageElement[]) {
  return { querySelectorAll: () => images, style: {}, scrollWidth: 1280, scrollHeight: 800 } as unknown as HTMLElement;
}
function imageResponse() { return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }); }

describe("export image acquisition", () => {
  it("reads COS through same-origin proxy when direct CORS fetch fails", async () => {
    const image = fakeImage();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https:")) throw new TypeError("CORS blocked");
      return imageResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    await inlineShareCardImagesForExport(fakeCard([image]));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://cdn.example.test/cover.png",
      "/api/image-proxy?url=https%3A%2F%2Fcdn.example.test%2Fcover.png"
    ]);
    expect(image.src).toMatch(/^data:image\/png;base64,/);
    expect(image.style.opacity).toBe("1");
  });
  it("fetches repeated covers once and reads export-only source attributes", async () => {
    const fetchMock = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchMock);
    const images = Array.from({ length: 20 }, () => {
      const image = fakeImage("");
      image.dataset.exportSrc = "/uploads/cover.png";
      return image;
    });
    await inlineShareCardImagesForExport(fakeCard(images));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(images.every(image => image.src.startsWith("data:image/png"))).toBe(true);
  });
  it("limits a large export to four simultaneous image fetches", async () => {
    let active = 0, maxActive = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      active++;
      maxActive = Math.max(active, maxActive);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
      return imageResponse();
    }));
    await inlineShareCardImagesForExport(fakeCard(Array.from({ length: 40 }, (_, i) => fakeImage(`/cover-${i}.png`))));
    expect(maxActive).toBe(4);
  });
  it("reports missing images instead of silently generating blank slots", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    await expect(inlineShareCardImagesForExport(fakeCard([fakeImage("/missing.png")]))).rejects.toThrow("1 张封面");
    expect(toPng).not.toHaveBeenCalled();
  });
  it("enforces a shared deadline across the whole export", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = inlineShareCardImagesForExport(fakeCard(Array.from({ length: 20 }, (_, i) => fakeImage(`/timeout-${i}.png`))), 100);
    const assertion = expect(pending).rejects.toThrow("20 张封面");
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("PNG capture", () => {
  function setup() {
    const originalImage = fakeImage("/cover.png");
    const clone = fakeCard([fakeImage("/cover.png")]);
    const original = { ...fakeCard([originalImage]), cloneNode: vi.fn(() => clone) };
    const container = { querySelector: () => original } as unknown as HTMLElement;
    const host = { style: {}, setAttribute: vi.fn(), appendChild: vi.fn(), remove: vi.fn() };
    const link = { download: "", href: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: (tag: string) => tag === "a" ? link : host,
      body: { appendChild: vi.fn(), removeChild: vi.fn() } });
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse()));
    vi.mocked(toPng).mockResolvedValue(PNG);
    return { container, originalImage, clone, host, link };
  }
  it("captures a clone, preserves the live DOM and cleans up", async () => {
    const f = setup();
    await expect(exportShareCardAsPng(f.container, { filename: "test-tier" })).resolves.toEqual({ dataUrl: PNG });
    expect(f.originalImage.src).toBe("/cover.png");
    expect(toPng).toHaveBeenCalledWith(f.clone, expect.objectContaining({ cacheBust: false, includeQueryParams: true, skipAutoScale: false, pixelRatio: 2 }));
    expect(f.link.download).toBe("test-tier.png");
    expect(f.link.click).toHaveBeenCalledOnce();
    expect(f.host.remove).toHaveBeenCalledOnce();
  });
  it("rejects invalid canvas output and cleans up on failure", async () => {
    const f = setup();
    vi.mocked(toPng).mockResolvedValue("data:,");
    await expect(exportShareCardAsPng(f.container)).rejects.toThrow("有效图片");
    expect(f.link.click).not.toHaveBeenCalled();
    expect(f.host.remove).toHaveBeenCalledOnce();
  });
  it("reduces raster size for large lists instead of exceeding canvas limits", () => {
    const ratio = getExportPixelRatio(1280, 12000);
    expect(12000 * ratio).toBeLessThanOrEqual(4096);
    expect(1280 * 12000 * ratio ** 2).toBeLessThanOrEqual(8_000_000);
    expect(() => getExportPixelRatio(0, 100)).toThrow();
  });
  it("does not mistake complete broken images for decoded covers", async () => {
    vi.useFakeTimers();
    const image = fakeImage();
    Object.assign(image, { naturalWidth: 0 });
    let resolved = false;
    const pending = waitForShareCardImages(fakeCard([image]), 100).then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(resolved).toBe(true);
  });
});
