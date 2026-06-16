import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyToClipboard } from "../src/lib/clipboard";

describe("copyToClipboard", () => {
  let mockWriteText: ReturnType<typeof vi.fn>;
  let mockExecCommand: ReturnType<typeof vi.fn>;
  let textareas: HTMLTextAreaElement[];

  beforeEach(() => {
    mockWriteText = vi.fn();
    mockExecCommand = vi.fn();
    textareas = [];

    const mockClipboard = { writeText: mockWriteText };
    vi.stubGlobal("navigator", { clipboard: mockClipboard });

    vi.stubGlobal("document", {
      createElement: vi.fn((_tag: string) => {
        const ta = {
          value: "",
          style: {} as Record<string, string>,
          setAttribute: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn()
        } as unknown as HTMLTextAreaElement;
        textareas.push(ta);
        return ta;
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      execCommand: mockExecCommand
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok when clipboard API succeeds", async () => {
    mockWriteText.mockResolvedValue(undefined);
    const result = await copyToClipboard("test");
    expect(result.ok).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith("test");
  });

  it("falls back to execCommand when clipboard API rejects", async () => {
    mockWriteText.mockRejectedValue(new Error("NotAllowedError"));
    mockExecCommand.mockReturnValue(true);
    const result = await copyToClipboard("test fallback");
    expect(result.ok).toBe(true);
    expect(mockWriteText).toHaveBeenCalled();
    expect(mockExecCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back to execCommand when clipboard API is not available", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    mockExecCommand.mockReturnValue(true);
    const result = await copyToClipboard("test no API");
    expect(result.ok).toBe(true);
    expect(mockExecCommand).toHaveBeenCalledWith("copy");
  });

  it("returns ok: false when both methods fail", async () => {
    mockWriteText.mockRejectedValue(new Error("NotAllowedError"));
    mockExecCommand.mockReturnValue(false);
    const result = await copyToClipboard("test fail");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("自动复制失败，请手动复制下面的链接。");
    }
  });

  it("returns ok: false when clipboard is absent and execCommand fails", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    mockExecCommand.mockReturnValue(false);
    const result = await copyToClipboard("final");
    expect(result.ok).toBe(false);
  });

  it("does not fail silently in non-secure context scenario", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    mockExecCommand.mockReturnValue(true);
    const result = await copyToClipboard("http context");
    expect(result.ok).toBe(true);
    expect(mockExecCommand).toHaveBeenCalled();
  });
});
