import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextWithFallback } from "../src/lib/browser-copy";

function makeTextarea() {
  const node = {
    value: "",
    style: {} as Record<string, string>,
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn()
  };
  return node as unknown as HTMLTextAreaElement;
}

function stubDocument(execCommandResult: boolean) {
  const created = makeTextarea();
  const appendChild = vi.fn();
  const removeChild = vi.fn();
  vi.stubGlobal("document", {
    createElement: vi.fn(() => created),
    body: { appendChild, removeChild },
    execCommand: vi.fn(() => execCommandResult)
  });
  return { created, appendChild, removeChild };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextWithFallback", () => {
  it("uses the async Clipboard API in a secure context and reports success", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("window", { isSecureContext: true });

    await expect(copyTextWithFallback("pool-123")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("pool-123");
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    const { created } = stubDocument(true);
    vi.stubGlobal("navigator", { clipboard: undefined });
    vi.stubGlobal("window", { isSecureContext: false });

    await expect(copyTextWithFallback("pool-123")).resolves.toBe("copied");
    expect(created.value).toBe("pool-123");
  });

  it("reports manual when every copy path fails", async () => {
    stubDocument(false);
    vi.stubGlobal("navigator", { clipboard: undefined });
    vi.stubGlobal("window", { isSecureContext: false });

    await expect(copyTextWithFallback("pool-123")).resolves.toBe("manual");
  });

  it("reports manual when the Clipboard API throws and execCommand fails", async () => {
    stubDocument(false);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        })
      }
    });
    vi.stubGlobal("window", { isSecureContext: true });

    await expect(copyTextWithFallback("pool-123")).resolves.toBe("manual");
  });

  it("does not claim success when nothing is available (no DOM access)", async () => {
    // No navigator/window/document stubs at all: nothing can succeed.
    await expect(copyTextWithFallback("pool-123")).resolves.toBe("manual");
  });
});
