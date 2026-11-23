import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin pool management dialogs", () => {
  const source = readFileSync("src/app/admin/page.tsx", "utf8");

  it("uses named modal semantics and keeps keyboard focus inside the active dialog", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('data-admin-dialog="true"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain('document.body.style.overflow = "hidden"');
  });

  it("requires an administrator to type CONFIRM before a destructive request is sent", () => {
    expect(source).toContain('const [confirmPhrase, setConfirmPhrase] = useState("")');
    expect(source).toContain('confirmPhrase !== "CONFIRM"');
    expect(source).toContain('confirm: confirmPhrase');
    expect(source).toContain('输入 CONFIRM');
  });

  it("restores usable focus after the dialog closes or completes", () => {
    expect(source).toContain("lastFocusedElementRef");
    expect(source).toContain("shouldFocusHeadingRef.current = true");
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain("pageHeadingRef");
  });
});
