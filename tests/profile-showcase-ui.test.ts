import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("profile showcase layout", () => {
  const profile = readFileSync("src/app/u/[username]/page.tsx", "utf8");
  const preview = readFileSync("src/components/ProfileTastePreview.tsx", "utf8");
  const nav = readFileSync("src/components/AuthNav.tsx", "utf8");
  const taste = readFileSync("src/components/TasteDashboard.tsx", "utf8");

  it("uses a wide, artwork-first layout, with taste analysis in a secondary tab", () => {
    expect(profile).toContain("max-w-6xl");
    expect(profile).not.toContain("max-w-4xl");
    expect(profile).toContain('value: "taste", label: "口味分析"');
    expect(profile).toContain('section === "taste"');
    expect(profile).toContain('<ProfileTastePreview username={username}');
    expect(profile).toContain("公开榜单");
    expect(profile).toContain("公开番组");
    expect(taste).toContain('useState<"taste" | "matches">("taste")');
  });

  it("groups identically titled shares without losing distinct URLs", () => {
    expect(profile).toContain("groupByLabel");
    expect(profile).toContain("group.entries.slice(1).map");
    expect(profile).toContain('"/share/tier/" + item.token');
    expect(profile).toContain('"/pools/" + item.id');
  });

  it("summarizes actual taste data rather than inventing favorites", () => {
    expect(preview).toContain("featureRequest<Taste>");
    expect(preview).toContain("data?.profile.tags.slice(0, 5)");
    expect(preview).toContain("data?.profile.favorites.slice(0, 3)");
  });

  it("shows a visible profile entrance alongside the account menu", () => {
    expect(nav).toContain('aria-label="个人主页" title="个人主页"');
    expect(nav).toContain('<span className="hidden 2xl:inline">个人主页</span>');
  });
});
