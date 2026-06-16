import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForShareCardImages } from "../src/lib/share-export";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("waitForShareCardImages", () => {
  it("finds real img nodes inside the share card and resolves loaded images", async () => {
    const img = fakeImage({ complete: true, naturalWidth: 320, naturalHeight: 180 });
    const card = fakeCard([img]);

    await expect(waitForShareCardImages(card, 10)).resolves.toBeUndefined();
    expect(card.querySelectorAll).toHaveBeenCalledWith("img");
  });

  it("does not treat complete images with naturalWidth 0 as loaded", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const img = fakeImage({ complete: true, naturalWidth: 0, naturalHeight: 0 });
    const card = fakeCard([img]);
    let resolved = false;

    const pending = waitForShareCardImages(card, 100).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(resolved).toBe(true);
    expect(img.addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      { once: true }
    );
  });

  it("allows a single failed image to settle without rejecting the whole export", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const loaded = fakeImage({ complete: true, naturalWidth: 120, naturalHeight: 120 });
    const failed = fakeImage({ complete: false, naturalWidth: 0, naturalHeight: 0 });
    failed.addEventListener.mockImplementation((event, handler) => {
      if (event === "error") {
        setTimeout(() => handler(new Event("error")), 0);
      }
    });
    const card = fakeCard([loaded, failed]);

    await expect(waitForShareCardImages(card, 100)).resolves.toBeUndefined();
  });
});

function fakeCard(images: ReturnType<typeof fakeImage>[]) {
  return {
    querySelectorAll: vi.fn(() => images)
  } as unknown as HTMLElement & {
    querySelectorAll: ReturnType<typeof vi.fn>;
  };
}

function fakeImage({
  complete,
  naturalWidth,
  naturalHeight
}: {
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
}) {
  return {
    complete,
    naturalWidth,
    naturalHeight,
    src: "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimg.png",
    currentSrc: "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimg.png",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as HTMLImageElement & {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
}
