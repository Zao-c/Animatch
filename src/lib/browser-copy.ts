export type CopyTextResult = "copied" | "manual";

export async function copyTextWithFallback(text: string): Promise<CopyTextResult> {
  try {
    if (navigator.clipboard !== undefined && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // Fall through to the legacy copy path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }

    if (copied) {
      return "copied";
    }
  } catch {
    // The browser can block both clipboard APIs on non-secure origins.
  }

  return "manual";
}
