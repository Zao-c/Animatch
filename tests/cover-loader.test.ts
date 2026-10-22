import { afterEach, describe, expect, it, vi } from "vitest";
import { CoverRequestQueue, coverLoaderStats, loadCoverImage, rememberedCover } from "../src/lib/cover-loader";
import { getCoverDeliveryCandidates } from "../src/lib/image-proxy";

class ControlledImage {
  private source = "";
  get src() { return this.source; }
  set src(value: string) { this.source = value; }
  naturalWidth = 1;
  complete = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  setAttribute() {}
  removeAttribute() { this.src = ""; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("bounded cover requests", () => {
  it("limits local traffic to two requests and remote traffic to four", async () => {
    const images: ControlledImage[] = [];
    const queue = new CoverRequestQueue(() => { const image = new ControlledImage(); images.push(image); return image as unknown as HTMLImageElement; });
    const controller = new AbortController();
    const pending = Promise.allSettled(Array.from({ length: 10 }, (_, i) => queue.load(i < 5 ? `/local-${i}` : `https://img.test/${i}`, { signal: controller.signal })));
    expect(queue.stats()).toEqual({ active: { local: 2, remote: 4 }, queued: 4 });
    controller.abort(); await pending;
    expect(queue.stats()).toEqual({ active: { local: 0, remote: 0 }, queued: 0 });
    expect(images.every((image) => image.src === "")).toBe(true);
  });
  it("starts visible covers before queued preloads and removes cancelled waiting work", async () => {
    const images: ControlledImage[] = [];
    const queue = new CoverRequestQueue(() => { const image = new ControlledImage(); images.push(image); return image as unknown as HTMLImageElement; }, { local: 1, remote: 1 });
    const controller = new AbortController();
    const pending = Promise.allSettled([
      queue.load("/first", { signal: controller.signal }),
      queue.load("/preload", { signal: controller.signal, priority: 2 }),
      queue.load("/visible", { signal: controller.signal, priority: 0 })
    ]);
    images[0].onload?.();
    expect(images[1].src).toBe("/visible");
    controller.abort(); await pending;
    expect(images).toHaveLength(2);
  });
  it("times out active image requests and releases their slots", async () => {
    vi.useFakeTimers();
    const queue = new CoverRequestQueue(() => new ControlledImage() as unknown as HTMLImageElement);
    const result = queue.load("/hang", { signal: new AbortController().signal, timeoutMs: 25 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(25);
    expect((await result).message).toContain("timeout");
    expect(queue.stats().active.local).toBe(0);
  });
});

describe("cover failover", () => {
  it("keeps a same-origin cache path behind COS and includes original-source fallbacks", () => {
    const cos = "https://test.cos.ap-shanghai.myqcloud.com/animatch/covers/one.webp";
    const bgm = "https://lain.bgm.tv/pic/cover/l/one.jpg";
    expect(getCoverDeliveryCandidates(cos, cos, [bgm])).toEqual([cos, `/api/image-proxy?url=${encodeURIComponent(cos)}`, `/api/image-proxy?url=${encodeURIComponent(bgm)}`, bgm]);
  });
  it("switches to a working fallback while the primary is still hanging", async () => {
    vi.useFakeTimers();
    const images: ControlledImage[] = [];
    class Image extends ControlledImage {
      constructor() { super(); images.push(this); }
      set src(value: string) { if (value === "/hedge-backup") setTimeout(() => this.onload?.(), 0); }
      get src() { return ""; }
    }
    vi.stubGlobal("Image", Image);
    const sources = ["https://img.test/hedge-hang", "/hedge-backup"];
    const controller = new AbortController();
    const result = loadCoverImage(sources, { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(801);
    await expect(result).resolves.toBe("/hedge-backup");
    expect(rememberedCover(sources)).toBe("/hedge-backup");
    expect(coverLoaderStats().active).toEqual({ local: 0, remote: 0 });
    controller.abort();
  });
  it("coalesces duplicate covers and does not abort another subscriber", async () => {
    vi.useFakeTimers();
    const images: ControlledImage[] = [];
    vi.stubGlobal("Image", class extends ControlledImage { constructor() { super(); images.push(this); } });
    const first = new AbortController(), second = new AbortController();
    const one = loadCoverImage(["/shared-test-cover"], { signal: first.signal }).catch((e) => e);
    const two = loadCoverImage(["/shared-test-cover"], { signal: second.signal });
    await vi.advanceTimersByTimeAsync(0);
    expect(images).toHaveLength(1);
    first.abort();
    expect((await one).name).toBe("AbortError");
    expect(images[0].src).toBe("/shared-test-cover");
    images[0].onload?.();
    await expect(two).resolves.toBe("/shared-test-cover");
    second.abort();
  });
});
