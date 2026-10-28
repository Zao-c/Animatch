import { describe, expect, it, vi } from "vitest";
import { registerUnsavedChangesGuard } from "../src/lib/unsaved-changes-guard";

const currentUrl = "https://animatch.example/pools/demo/tier-maker";

function setup(withNavigation = true) {
  const navigation = new EventTarget();
  const browser = Object.assign(new EventTarget(), {
    document: new EventTarget(),
    location: { href: currentUrl },
    navigation: withNavigation ? navigation : undefined,
    confirm: vi.fn(() => false),
    clearTimeout: vi.fn()
  });
  const cleanup = registerUnsavedChangesGuard(browser as unknown as Window, "未保存，确定离开？");
  return { browser, navigation, cleanup };
}

function traversal(url: string, options: { cancelable?: boolean; sameDocument?: boolean; type?: string } = {}) {
  return Object.assign(new Event("navigate", { cancelable: options.cancelable ?? true }), {
    navigationType: options.type ?? "traverse",
    destination: { url, sameDocument: options.sameDocument ?? true }
  });
}

describe("unsaved ranking navigation", () => {
  it("cancels a history departure, and permits a later departure when the user agrees", () => {
    const { browser, navigation, cleanup } = setup();
    const back = traversal("https://animatch.example/pools/demo");
    navigation.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(browser.confirm).toHaveBeenCalledWith("未保存，确定离开？");

    browser.confirm.mockReturnValue(true);
    const forward = traversal("https://animatch.example/pools/demo/runs/latest/tier");
    navigation.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(false);
    expect(browser.confirm).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("guards history entries that change the query, but allows hash-only navigation", () => {
    const { browser, navigation, cleanup } = setup();
    const queryChange = traversal(`${currentUrl}?view=shared`);
    navigation.dispatchEvent(queryChange);
    expect(queryChange.defaultPrevented).toBe(true);
    navigation.dispatchEvent(traversal(`${currentUrl}#pending`));
    expect(browser.confirm).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("leaves full document departures to the native unload confirmation", () => {
    const { browser, navigation, cleanup } = setup();
    navigation.dispatchEvent(traversal("https://animatch.example/pools", { sameDocument: false }));
    expect(browser.confirm).not.toHaveBeenCalled();
    const unload = new Event("beforeunload", { cancelable: true });
    browser.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    cleanup();
  });

  it("does not show a confirmation it cannot enforce or duplicate a canceled event", () => {
    const { browser, navigation, cleanup } = setup();
    navigation.dispatchEvent(traversal("https://animatch.example/pools", { cancelable: false }));
    const canceled = traversal("https://animatch.example/pools");
    canceled.preventDefault();
    navigation.dispatchEvent(canceled);
    navigation.dispatchEvent(traversal("https://animatch.example/pools", { type: "push" }));
    expect(browser.confirm).not.toHaveBeenCalled();
    cleanup();
  });

  it("removes guards after saving or unmounting, including a mount/cleanup/remount cycle", () => {
    const { browser, navigation, cleanup } = setup();
    cleanup();
    const remountCleanup = registerUnsavedChangesGuard(browser as unknown as Window, "未保存，确定离开？");
    navigation.dispatchEvent(traversal("https://animatch.example/pools"));
    expect(browser.confirm).toHaveBeenCalledTimes(1);
    remountCleanup();
    browser.confirm.mockClear();
    const departure = traversal("https://animatch.example/pools");
    navigation.dispatchEvent(departure);
    const unload = new Event("beforeunload", { cancelable: true });
    browser.dispatchEvent(unload);
    expect(browser.confirm).not.toHaveBeenCalled();
    expect(departure.defaultPrevented).toBe(false);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("keeps the unload guard available in browsers without the Navigation API", () => {
    const { browser, cleanup } = setup(false);
    const unload = new Event("beforeunload", { cancelable: true });
    browser.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    cleanup();
  });
});
