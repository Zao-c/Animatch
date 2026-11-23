interface TraverseEvent extends Event {
  navigationType: string;
  destination: { url: string; sameDocument: boolean };
}

type NavigationWindow = Window & { navigation?: EventTarget };

function staysOnPage(destination: URL, current: URL): boolean {
  return destination.origin === current.origin &&
    destination.pathname === current.pathname &&
    destination.search === current.search;
}

/** Register only while dirty. Never add history entries or alter Next's router state. */
export function registerUnsavedChangesGuard(browser: Window, message: string): () => void {
  let approvedLink = false;
  let approvalTimer: number | undefined;
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (approvedLink) return;
    event.preventDefault();
    event.returnValue = "";
  };

  const beforeNavigate = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || typeof link.href !== "string" || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const target = new URL(link.href, browser.location.href);
    if (!["http:", "https:"].includes(target.protocol) || staysOnPage(target, new URL(browser.location.href))) return;
    if (!browser.confirm(message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else {
      // A normal link unloads in this task; do not ask again after approval.
      approvedLink = true;
      browser.clearTimeout(approvalTimer);
      approvalTimer = browser.setTimeout(() => { approvedLink = false; }, 0);
    }
  };

  const beforeTraverse = (event: Event) => {
    const navigation = event as TraverseEvent;
    // Full document departures use beforeunload. Hash changes keep the editor mounted.
    // Non-cancelable events and older browsers keep the per-tab recovery fallback.
    if (navigation.navigationType !== "traverse" || !event.cancelable || event.defaultPrevented || !navigation.destination.sameDocument) return;
    if (staysOnPage(new URL(navigation.destination.url), new URL(browser.location.href))) return;
    if (!browser.confirm(message)) event.preventDefault();
  };

  const navigation = (browser as NavigationWindow).navigation;
  browser.addEventListener("beforeunload", beforeUnload);
  browser.document.addEventListener("click", beforeNavigate, true);
  navigation?.addEventListener("navigate", beforeTraverse);

  return () => {
    browser.clearTimeout(approvalTimer);
    browser.removeEventListener("beforeunload", beforeUnload);
    browser.document.removeEventListener("click", beforeNavigate, true);
    navigation?.removeEventListener("navigate", beforeTraverse);
  };
}
