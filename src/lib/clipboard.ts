export type CopyResult =
  | { ok: true }
  | { ok: false; message: string };

export async function copyToClipboard(text: string): Promise<CopyResult> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch {
    // clipboard API failed, try fallback
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "true");
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (success) {
      return { ok: true };
    }
  } catch {
    // execCommand failed
  }

  return {
    ok: false,
    message: "自动复制失败，请手动复制下面的链接。"
  };
}
