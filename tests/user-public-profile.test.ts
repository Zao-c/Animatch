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

  it("takes max 12 pools and tier lists", () => {
    expect(source).toContain("take: 12");
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
    expect(source).toContain("公开榜单");
    expect(source).toContain("href={`/share/tier/${tl.token}`}");
  });

  it("renders public pools section with links", () => {
    expect(source).toContain("公开番组");
    expect(source).toContain("href={`/pools/${pool.id}`}");
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

  it("uses PageShell for navigation wrapping", () => {
    expect(source).toContain("PageShell");
  });

  it("uses proxyExternalImageUrl for cover images", () => {
    expect(source).toContain("proxyExternalImageUrl");
  });
});

describe("AuthNav links to user profile", () => {
  const source = readFileSync("src/components/AuthNav.tsx", "utf8");

  it("username is wrapped in Link to /u/${username}", () => {
    expect(source).toContain("href={user.username ? `/u/${user.username}`");
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
    expect(source).toContain("underline decoration-cyan-400/40");
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
