import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCoverImage, coverLoaderStats } from "../src/lib/cover-loader";
class HangingImage {
  src = ""; naturalWidth = 1; complete = false;
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  setAttribute() {} removeAttribute() { this.src = ""; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("cover deadline and cancellation", () => {
  it("bounds a whole cover attempt even when all sources hang", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Image", HangingImage);
    const pending = loadCoverImage(["/deadline-a", "/deadline-b"], {signal:new AbortController().signal}).catch(e => e);
    await vi.advanceTimersByTimeAsync(24001);
    expect(await pending).toBeInstanceOf(Error);
    expect(coverLoaderStats().active).toEqual({local:0,remote:0});
    expect(coverLoaderStats().queued).toBe(0);
  });
  it("allows immediate retry after the last subscriber cancels without deleting the replacement flight", async () => {
    vi.useFakeTimers(); const images:HangingImage[]=[];
    vi.stubGlobal("Image", class extends HangingImage {constructor(){super();images.push(this);}});
    const old = new AbortController(), current = new AbortController();
    const first=loadCoverImage(["/replacement-flight"],{signal:old.signal}).catch(e=>e);
    await vi.advanceTimersByTimeAsync(0); old.abort(); await first;
    const second=loadCoverImage(["/replacement-flight"],{signal:current.signal});
    await vi.advanceTimersByTimeAsync(0);
    expect(images).toHaveLength(2); expect(coverLoaderStats().inFlight).toBe(1);
    images[1].onload?.(); await expect(second).resolves.toBe("/replacement-flight");
    current.abort(); expect(coverLoaderStats().inFlight).toBe(0);
  });
});
