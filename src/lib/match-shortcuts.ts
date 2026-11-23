import type { ComparisonResult } from "./client-api";

export function getComparisonResultForShortcut(event: {
  key: string;
  target: EventTarget | null;
}): ComparisonResult | null {
  if (isInteractiveShortcutTarget(event.target)) {
    return null;
  }

  switch (event.key) {
    case "ArrowLeft":
      return "LEFT_WIN";
    case "ArrowRight":
      return "RIGHT_WIN";
    case "ArrowUp":
      return "DRAW";
    case "ArrowDown":
      return "SKIP";
    case "1":
      return "LEFT_UNSEEN";
    case "2":
      return "RIGHT_UNSEEN";
    case "0":
      return "BOTH_UNSEEN";
    default:
      return null;
  }
}

export function isInteractiveShortcutTarget(target: EventTarget | null) {
  if (target === null) {
    return false;
  }

  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    const interactiveAncestor = target.closest(
      'input, textarea, select, button, a, summary, details, option, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="tab"]'
    );
    return (
      target.isContentEditable ||
      interactiveAncestor !== null
    );
  }

  const structuralTarget = target as EventTarget & {
    tagName?: string;
    isContentEditable?: boolean;
    role?: string;
    getAttribute?: (name: string) => string | null;
  };
  const tagName = structuralTarget.tagName?.toUpperCase();
  const role = structuralTarget.role ?? structuralTarget.getAttribute?.("role") ?? "";

  return (
    structuralTarget.isContentEditable === true ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    tagName === "BUTTON" ||
    tagName === "A" ||
    tagName === "SUMMARY" ||
    tagName === "DETAILS" ||
    tagName === "OPTION" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "checkbox" ||
    role === "switch" ||
    role === "tab"
  );
}
