import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compact profile showcase built on the current paginated API", () => {
  const profile = readFileSync("src/app/u/[username]/page.tsx", "utf8");
  const route = readFileSync("src/app/api/users/[username]/public-profile/route.ts", "utf8");
  const nav = readFileSync("src/components/AuthNav.tsx", "utf8");
  const tierlists = readFileSync("src/app/tierlists/page.tsx", "utf8");

  it("shows actual cover images without padded placeholder slots or redundant card badges", () => {
    expect(profile).toContain("max-w-6xl");
    expect(profile).toContain("uniqueCovers.length ? uniqueCovers.map");
    expect(profile).toContain("new Set(covers.filter(Boolean))");
    expect(profile).not.toContain("Array.from({ length: 5 }");
    expect(profile).not.toContain('category="公开番组"');
    expect(profile).not.toContain('aria-label="个人公开作品统计"');
    expect(profile).toContain("分享主页");
  });

  it("keeps every public collection, existing paging, and taste access", () => {
    expect(profile).toContain("profileCollectionUrl(username, contentTab, contentPage)");
    expect(profile).toContain("<CollectionPager");
    expect(profile).toContain("profile.publicSongTierLists.map");
    expect(profile).toContain("profile.publicSongPlaylists.map");
    expect(profile).toContain("profile.publicTierLists.map");
    expect(profile).toContain("profile.publicPools.map");
    expect(profile).toContain("<TasteDashboard username={username}");
    expect(profile).toContain("头像");
    expect(route).toContain("resolveProfileSection");
    expect(route).toContain("PROFILE_PAGE_SIZE");
  });

  it("provides useful shortcuts without occupying the smallest mobile header", () => {
    expect(nav).toContain('href="/tierlists?view=mine"');
    expect(nav).toContain('aria-label="我的榜单"');
    expect(nav).toContain('aria-label="个人主页"');
    expect(nav).toContain("lg:inline-flex");
    expect(nav).toContain("sm:inline-flex");
    expect(nav).toContain("账号设置");
  });

  it("guards saved boards by the current owner and retains published shares separately", () => {
    expect(tierlists).toContain('searchParams.view === "mine"');
    expect(tierlists).toContain('if (!user) redirect("/login?next="');
    expect(tierlists).toContain("ownerId: user.id");
    expect(tierlists).toContain("prisma.manualTierBoard.findMany");
    expect(tierlists).toContain("prisma.tierShare.findMany");
    expect(tierlists).toContain('href="/anisong/mine"');
  });
});
