import { afterEach, describe, expect, it, vi } from "vitest";
import { toPng } from "html-to-image";
import { exportShareCardAsPng, waitForShareCardImages } from "../src/lib/share-export";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,exported")
}));

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

describe("exportShareCardAsPng", () => {
  it("passes an image placeholder to html-to-image so failed images do not reject export", async () => {
    const card = fakeCard([
      fakeImage({ complete: true, naturalWidth: 320, naturalHeight: 180 })
    ]);
    const container = fakeContainer(card);
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,exported");

    await expect(
      exportShareCardAsPng(container, { filename: "test-tier" })
    ).resolves.toEqual({ dataUrl: "data:image/png;base64,exported" });

    expect(toPng).toHaveBeenCalledWith(
      card,
      expect.objectContaining({
        backgroundColor: "#101310",
        cacheBust: true,
        imagePlaceholder: expect.stringMatching(/^data:image\/gif;base64,/),
        pixelRatio: 2,
        skipAutoScale: true
      })
    );
  });

  it("uses the caller timeout while waiting for image load before export", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,exported");
    const card = fakeCard([
      fakeImage({ complete: false, naturalWidth: 0, naturalHeight: 0 })
    ]);
    const container = fakeContainer(card);

    const pending = exportShareCardAsPng(container, { timeoutMs: 25 });
    await Promise.resolve();
    expect(toPng).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(25);
    await pending;
    expect(toPng).toHaveBeenCalledOnce();
  });
});

function fakeCard(images: ReturnType<typeof fakeImage>[]) {
  return {
    querySelectorAll: vi.fn(() => images)
  } as unknown as HTMLElement & {
    querySelectorAll: ReturnType<typeof vi.fn>;
  };
}

function fakeContainer(card: ReturnType<typeof fakeCard>) {
  return {
    querySelector: vi.fn(() => card)
  } as unknown as HTMLElement;
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
