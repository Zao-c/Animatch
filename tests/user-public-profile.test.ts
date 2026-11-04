import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("User public profile API", () => {
  const source = readFileSync("src/app/api/users/[username]/public-profile/route.ts", "utf8");

  it("returns user not found for non-existent username", () => {
    expect(source).toContain('notFound("用户不存在")');
  });

  it("only selects safe user fields (excludes email)", () => {
    expect(source).toContain('select: {');
    expect(source).toContain("id: true");
    expect(source).toContain("username: true");
    expect(source).toContain("name: true");
    expect(source).toContain("image: true");
    expect(source).toContain("createdAt: true");
    expect(source).not.toContain("email");
  });

  it("filters deleted users", () => {
    expect(source).toContain("deletedAt: null");
  });

  it("only returns PUBLIC pools", () => {
    expect(source).toContain('visibility: "PUBLIC"');
  });

  it("filters deleted pools", () => {
    expect(source).toContain("deletedAt: null");
  });

  it("counts public pools", () => {
    expect(source).toContain("publicPoolsCount");
  });

  it("counts shared tier lists via PersonalRun join", () => {
    expect(source).toContain("run: {");
    expect(source).toContain("userId: user.id");
  });

  it("counts participated pools via UserPoolScore groupBy", () => {
    expect(source).toContain("userPoolScore.groupBy");
    expect(source).toContain("participatedPoolCount");
  });

  it("returns coverUrls via getAnimeCoverUrl with display intent", () => {
    expect(source).toContain('getAnimeCoverUrl(a, { intent: "display" })');
  });

  it("includes pool description and counts", () => {
    expect(source).toContain("description: pool.description");
    expect(source).toContain("animeCount: pool._count.poolAnime");
  });

  it("includes tier list pool name, anime count, comparison count", () => {
    expect(source).toContain("poolName");
    expect(source).toContain("animeCount");
    expect(source).toContain("comparisonCount");
  });

  it("server-paginates each public collection instead of truncating all content after 12 entries", () => {
    expect(source).toContain("export const PROFILE_PAGE_SIZE = 9");
    expect(source).toContain("skip,");
    expect(source).toContain("take: PROFILE_PAGE_SIZE");
    expect(source).toContain("pagination: { section, page, pageSize: PROFILE_PAGE_SIZE");
    expect(source).not.toContain("take: 12");
  });

  it("includes only explicitly shared public music content and never private song source data", () => {
    expect(source).toContain("prisma.songTemplate.findMany");
    expect(source).toContain("ownerId: user.id, active: true");
    expect(source).toContain("prisma.songBoard.findMany");
    expect(source).toContain("shareToken: { not: null }");
    expect(source).toContain("publicSongPlaylistsCount");
    expect(source).toContain("sharedSongTierListCount");
    expect(source).not.toContain("source: track.source");
  });
});

describe("User profile page", () => {
  const source = readFileSync("src/app/u/[username]/page.tsx", "utf8");

  it("renders user not found state", () => {
    expect(source).toContain("用户不存在");
  });

  it("renders loading state with skeleton", () => {
    expect(source).toContain("ProfileSkeleton");
    expect(source).toContain("animate-pulse");
  });

  it("renders error state", () => {
    expect(source).toContain("加载失败");
  });

  it("renders user display name", () => {
    expect(source).toContain("displayName");
  });

  it("renders AniMatch 玩家 badge", () => {
    expect(source).toContain("AniMatch 玩家");
  });

  it("renders stats: public pools, tier lists, participated pools", () => {
    expect(source).toContain("publicPoolsCount");
    expect(source).toContain("sharedTierListCount");
    expect(source).toContain("participatedPoolCount");
  });

  it("renders public tier lists section with titles", () => {
    expect(source).toContain('href={"/share/tier/" + tl.token}');
  });

  it("renders public pools section with links", () => {
    expect(source).toContain('href={"/pools/" + pool.id}');
  });

  it("shows empty state for no tier lists", () => {
    expect(source).toContain("还没有公开榜单");
  });

  it("shows empty state for no pools", () => {
    expect(source).toContain("还没有创建公开番组");
  });

  it("does not render email anywhere", () => {
    expect(source).not.toContain("email");
  });

  it("uses site-wide profile width and does not nest a second main", () => {
    expect(source).toContain("PageShell");
    expect(source).toContain("max-w-[90rem]");
    expect(source).not.toContain("max-w-4xl");
    expect(source).not.toContain("<main");
  });

  it("keeps taste profile behind a tab and shows both public music collections", () => {
    expect(source).toContain('contentTab === "taste"');
    expect(source).toContain("publicSongPlaylists");
    expect(source).toContain("publicSongTierLists");
    expect(source).toContain("分享主页");
    expect(source).toContain("copyTextWithFallback");
  });

  it("uses proxyExternalImageUrl for cover images", () => {
    expect(source).toContain("proxyExternalImageUrl");
  });
});

describe("AuthNav links to user profile", () => {
  const source = readFileSync("src/components/AuthNav.tsx", "utf8");

  it("username is wrapped in Link to /u/${username}", () => {
    expect(source).toContain("user.username ? <Link href={`/u/${user.username}`}");
  });

  it("Link has hover styles", () => {
    expect(source).toContain("hover:border-anime-purple/50");
  });
});

describe("Tier share page links to author profile", () => {
  const source = readFileSync("src/components/TierShareView.tsx", "utf8");

  it("has getShareCreatorUsername helper", () => {
    expect(source).toContain("function getShareCreatorUsername");
    expect(source).toContain("snapshot.creator?.username?.trim()");
  });

  it("non-export header links creator name to /u/${username}", () => {
    expect(source).toContain('href={`/u/${creatorUsername}`}');
  });

  it("export card header links creator name to /u/${username}", () => {
    expect(source).toContain("underline decoration-slate-500/40");
  });

  it("falls back to plain text when username is null", () => {
    expect(source).toContain("creatorUsername ?");
  });
});

describe("Pool detail links to creator profile", () => {
  const source = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("creator name links to /u/${username}", () => {
    expect(source).toContain("pool.creator.username ?");
    expect(source).toContain('href={`/u/${pool.creator.username}`}');
  });

  it("has underline hover styles for creator link", () => {
    expect(source).toContain("decoration-slate-600/40");
    expect(source).toContain("hover:text-anime-purple");
  });

  it("falls back to plain span when no username", () => {
    expect(source).toContain('<span className="font-medium text-slate-300">');
  });
});
