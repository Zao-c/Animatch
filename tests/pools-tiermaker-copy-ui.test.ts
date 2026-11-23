import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextWithFallback } from "../src/lib/browser-copy";
import { TIERMAKER_IMPORT_ASSISTANT_SCRIPT } from "../src/lib/tiermaker-url-list";

describe("TierMaker assistant copy fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("copies with navigator.clipboard in secure contexts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubBrowserCopyGlobals({
      isSecureContext: true,
      clipboard: { writeText },
      execCommandResult: false
    });

    await expect(copyTextWithFallback("assistant script")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("assistant script");
  });

  it("falls back to manual UI result when clipboard rejects and execCommand fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    stubBrowserCopyGlobals({
      isSecureContext: true,
      clipboard: { writeText },
      execCommandResult: false
    });

    await expect(copyTextWithFallback("assistant script")).resolves.toBe("manual");
  });

  it("uses legacy execCommand when clipboard is unavailable on non-secure origins", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    stubBrowserCopyGlobals({
      isSecureContext: false,
      clipboard: undefined,
      execCommand
    });

    await expect(copyTextWithFallback("assistant script")).resolves.toBe("copied");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns manual when non-secure fallback copy is blocked", async () => {
    stubBrowserCopyGlobals({
      isSecureContext: false,
      clipboard: undefined,
      execCommandResult: false
    });

    await expect(copyTextWithFallback("assistant script")).resolves.toBe("manual");
  });
});

describe("TierMaker assistant manual copy UI wiring", () => {
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("shows manual copy instructions and the complete readonly script textarea", () => {
    expect(detailSource).toContain("copyTextWithFallback(TIERMAKER_IMPORT_ASSISTANT_SCRIPT)");
    expect(detailSource).toContain("浏览器禁止自动复制。请手动复制下面的脚本，然后到 TierMaker 页面 Console 粘贴运行。");
    expect(detailSource).toContain("自动复制失败，请手动选中脚本复制。");
    expect(detailSource).toContain("已复制脚本。请打开 TierMaker 模板页面，在 Console 粘贴并回车。");
    expect(detailSource).toContain("value={TIERMAKER_IMPORT_ASSISTANT_SCRIPT}");
    expect(detailSource).toContain("readOnly");
    expect(detailSource).toContain("选中脚本");
    expect(detailSource).toContain("我已复制");
  });

  it("keeps the manual copy block responsive at 390px", () => {
    expect(detailSource).toContain("w-full max-w-full overflow-auto");
    expect(detailSource).toContain("flex flex-wrap gap-2");
    expect(detailSource).not.toContain("<table");
    expect(detailSource).not.toMatch(/\b(?:w|mini?-w)-screen\b/);
    expect(detailSource).not.toMatch(/(?:w|mini?-w)-\[1264px\]/);
  });

  it("keeps the assistant security copy and script free of sensitive values", () => {
    expect(detailSource).toContain("document.images");
    expect(detailSource).toContain("不下载图片");
    expect(detailSource).toContain("不上传数据");
    expect(detailSource).toContain("不读取 cookie");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).toContain("document.images");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("document.cookie");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("FRIEND_INVITE_CODE");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("AUTH_SECRET");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("33989");
  });
});

function stubBrowserCopyGlobals(params: {
  isSecureContext: boolean;
  clipboard: { writeText: (text: string) => Promise<void> } | undefined;
  execCommand?: ReturnType<typeof vi.fn>;
  execCommandResult?: boolean;
}) {
  const appended: unknown[] = [];
  const textarea = {
    value: "",
    style: {},
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn()
  };
  const execCommand =
    params.execCommand ?? vi.fn().mockReturnValue(params.execCommandResult ?? false);

  vi.stubGlobal("window", {
    isSecureContext: params.isSecureContext
  });
  vi.stubGlobal("navigator", {
    clipboard: params.clipboard
  });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => textarea),
    execCommand,
    body: {
      appendChild: vi.fn((node: unknown) => appended.push(node)),
      removeChild: vi.fn((node: unknown) => {
        const index = appended.indexOf(node);
        if (index >= 0) appended.splice(index, 1);
      })
    }
  });

  return { execCommand, textarea };
}
