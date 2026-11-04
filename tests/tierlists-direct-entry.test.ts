import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("my tier lists direct shortcut", () => {
  const auth = readFileSync("src/components/AuthNav.tsx", "utf8");
  const page = readFileSync("src/app/tierlists/page.tsx", "utf8");
  it("links the top-right button to the dedicated personal list view", () => {
    expect(auth).toContain('href="/tierlists?view=mine"');
    expect(auth).toContain('aria-label="我的榜单"');
    expect(page).toContain('searchParams.view === "mine"');
  });
  it("keeps private saved boards and public published shares distinct", () => {
    expect(page).toContain("prisma.manualTierBoard.findMany");
    expect(page).toContain("prisma.tierShare.findMany");
    expect(page).toContain("我的自由榜");
    expect(page).toContain("已分享的 Tier List");
    expect(page).toContain("/anisong/mine");
  });
  it("requires sign-in before showing anyone's private drafts", () => {
    expect(page).toContain('if (!user) redirect("/login?next="');
    expect(page).toContain('ownerId: user.id');
  });
});
