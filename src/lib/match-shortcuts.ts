import type { ComparisonResult } from "./client-api";

export function getComparisonResultForShortcut(event: {
  key: string;
  target: EventTarget | null;
}): ComparisonResult | null {
  if (isEditableShortcutTarget(event.target)) {
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

function isEditableShortcutTarget(target: EventTarget | null) {
  if (target === null) {
    return false;
  }

  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    return (
      target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    );
  }

  const structuralTarget = target as EventTarget & {
    tagName?: string;
    isContentEditable?: boolean;
  };
  const tagName = structuralTarget.tagName?.toUpperCase();

  return (
    structuralTarget.isContentEditable === true ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}
