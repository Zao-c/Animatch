import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeProfileUsername, profilePath } from "@/lib/profile-username";
import {
  PROFILE_PAGE_SIZE,
  profileCollectionUrl,
  profilePageCount,
  resolveProfilePage,
  resolveProfileSection
} from "@/lib/user-profile";

const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  customPool: { count: vi.fn(), findMany: vi.fn() },
  tierShare: { count: vi.fn(), findMany: vi.fn() },
  userPoolScore: { groupBy: vi.fn() },
  songTemplate: { count: vi.fn(), findMany: vi.fn() },
  songBoard: { count: vi.fn(), findMany: vi.fn() }
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { GET } from "@/app/api/users/[username]/public-profile/route";

const user = {
  id: "user-1",
  username: "alice",
  name: "Alice",
  image: null,
  createdAt: new Date("2026-01-02T03:04:05.000Z")
};

async function call(path: string, username = "alice") {
  const response = await GET(new Request(`http://test.local${path}`), { params: { username } });
  return { response, body: await response.json() };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.user.findFirst.mockResolvedValue(user);
  db.customPool.count.mockResolvedValue(0);
  db.customPool.findMany.mockResolvedValue([]);
  db.tierShare.count.mockResolvedValue(0);
  db.tierShare.findMany.mockResolvedValue([]);
  db.userPoolScore.groupBy.mockResolvedValue([]);
  db.songTemplate.count.mockResolvedValue(0);
  db.songTemplate.findMany.mockResolvedValue([]);
  db.songBoard.count.mockResolvedValue(0);
  db.songBoard.findMany.mockResolvedValue([]);
});

describe("public profile API behaviour", () => {
  it("returns 404 for a missing or deleted user", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const { response, body } = await call("/api/users/alice/public-profile");
    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, error: { message: "用户不存在" } });
  });

  it("maps the shares tab to the tiers collection", async () => {
    const { body } = await call("/api/users/alice/public-profile?section=shares&page=1");
    expect(body.data.pagination.section).toBe("tiers");
  });

  it("paginates 27 tier lists through to the last page instead of truncating at 12", async () => {
    db.tierShare.count.mockResolvedValue(27);
    db.tierShare.findMany.mockResolvedValue(
      Array.from({ length: PROFILE_PAGE_SIZE }, (_, index) => ({
        token: `token-${index}`,
        title: `榜单 ${index}`,
        snapshot: {
          animeCount: 10,
          comparisonCount: 40,
          tiers: [{ items: [{ imageUrl: "https://img.example/cover.jpg" }] }]
        },
        createdAt: new Date("2026-02-03T00:00:00.000Z"),
        run: { pool: { id: "pool-1", name: "2026 冬季" } }
      }))
    );

    const { body } = await call("/api/users/alice/public-profile?section=shares&page=3");
    const lastCall = db.tierShare.findMany.mock.calls.at(-1)?.[0] as { skip: number; take: number };
    expect(lastCall).toMatchObject({ skip: 18, take: PROFILE_PAGE_SIZE });
    expect(body.data.pagination).toEqual({ section: "tiers", page: 3, pageSize: 9, total: 27 });
    expect(body.data.publicTierLists).toHaveLength(9);
    expect(body.data.publicTierLists[0]).toMatchObject({
      token: "token-0", poolName: "2026 冬季", animeCount: 10, comparisonCount: 40
    });
    expect(body.data.publicTierLists[0].coverUrls).toEqual(["https://img.example/cover.jpg"]);
  });

  it("uses the page size and offset for pool pagination", async () => {
    db.customPool.count.mockResolvedValue(27);
    await call("/api/users/alice/public-profile?section=pools&page=2");
    expect(db.customPool.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ skip: 9, take: 9 });
  });

  it("falls back to page 1 for empty, negative, fractional or non-numeric pages", async () => {
    for (const value of ["", "0", "-3", "2.5", "abc"]) {
      await call(`/api/users/alice/public-profile?section=pools&page=${encodeURIComponent(value)}`);
      expect(db.customPool.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ skip: 0 });
      expect(db.customPool.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ take: PROFILE_PAGE_SIZE });
    }
  });

  it("keeps the reported total in sync with the counter", async () => {
    db.customPool.count.mockResolvedValue(27);
    db.customPool.findMany.mockResolvedValue([]);
    const { body } = await call("/api/users/alice/public-profile?section=pools&page=3");
    expect(body.data.pagination.total).toBe(27);
    expect(body.data.stats.publicPoolsCount).toBe(27);
    expect(body.data.publicPools).toHaveLength(0);
  });

  it("only lists published (active) music playlists and returns no audio or source data", async () => {
    db.songTemplate.count.mockResolvedValue(1);
    db.songTemplate.findMany.mockResolvedValue([
      {
        id: "template-1",
        title: "秋季 OP",
        document: {
          tracks: [
            { id: "a", title: "A", source: { kind: "pool", assetId: "secret-asset" }, coverUrl: "https://img.example/a.jpg" },
            { id: "b", title: "B", source: { kind: "upload", key: "private/key.wav" }, coverUrl: null }
          ]
        },
        updatedAt: new Date("2026-03-04T00:00:00.000Z")
      }
    ]);
    const { body } = await call("/api/users/alice/public-profile?section=songs&page=1");
    expect(db.songTemplate.findMany.mock.calls.at(-1)?.[0]).toMatchObject({
      where: { ownerId: "user-1", active: true },
      skip: 0,
      take: PROFILE_PAGE_SIZE
    });
    expect(body.data.publicSongPlaylists).toEqual([
      {
        id: "template-1",
        title: "秋季 OP",
        trackCount: 2,
        coverUrls: ["https://img.example/a.jpg"],
        updatedAt: "2026-03-04T00:00:00.000Z"
      }
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secret-asset");
    expect(serialized).not.toContain("private/key.wav");
  });

  it("only treats explicitly shared music Tier snapshots as public", async () => {
    db.songBoard.count.mockResolvedValue(1);
    db.songBoard.findMany.mockResolvedValue([
      {
        shareToken: "song-token",
        title: "我的音乐榜",
        snapshot: {
          version: 1,
          title: "我的音乐榜",
          capturedAt: "2026-03-05T00:00:00.000Z",
          comparisons: 12,
          rows: [{ id: "s", label: "S", color: "#fff", songs: [{ id: "a", title: "A", coverUrl: "https://img.example/a.jpg" }] }]
        },
        updatedAt: new Date("2026-03-05T00:00:00.000Z")
      }
    ]);
    const { body } = await call("/api/users/alice/public-profile?section=songTiers&page=1");
    const where = (db.songBoard.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ ownerId: "user-1", shareToken: { not: null } });
    expect(where.snapshot).toEqual({ not: expect.anything() });
    expect(body.data.publicSongTierLists).toEqual([
      {
        token: "song-token",
        title: "我的音乐榜",
        trackCount: 1,
        comparisonCount: 12,
        coverUrls: ["https://img.example/a.jpg"],
        updatedAt: "2026-03-05T00:00:00.000Z"
      }
    ]);
  });

  it("never serializes email or comparison history", async () => {
    const { body } = await call("/api/users/alice/public-profile?section=pools&page=1");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("email");
    expect(body.data.user).toEqual({
      id: "user-1",
      username: "alice",
      name: "Alice",
      image: null,
      createdAt: "2026-01-02T03:04:05.000Z"
    });
  });
});

describe("profile pagination helpers", () => {
  it("clamps every page value to a safe positive integer", () => {
    expect(resolveProfilePage("1")).toBe(1);
    expect(resolveProfilePage("12")).toBe(12);
    expect(resolveProfilePage("0")).toBe(1);
    expect(resolveProfilePage("-2")).toBe(1);
    expect(resolveProfilePage("1.5")).toBe(1);
    expect(resolveProfilePage("abc")).toBe(1);
    expect(resolveProfilePage(null)).toBe(1);
    expect(resolveProfilePage("999999")).toBe(10000);
  });

  it("accepts shares as an alias for tiers and rejects unknown sections", () => {
    expect(resolveProfileSection("shares")).toBe("tiers");
    expect(resolveProfileSection("tiers")).toBe("tiers");
    expect(resolveProfileSection("songs")).toBe("songs");
    expect(resolveProfileSection("songTiers")).toBe("songTiers");
    expect(resolveProfileSection("taste")).toBe("pools");
    expect(resolveProfileSection(null)).toBe("pools");
  });

  it("computes page counts, always at least one page", () => {
    expect(profilePageCount(0)).toBe(1);
    expect(profilePageCount(9)).toBe(1);
    expect(profilePageCount(10)).toBe(2);
    expect(profilePageCount(27)).toBe(3);
    expect(profilePageCount(Number.NaN)).toBe(1);
  });

  it("keeps the section and page together in one request URL", () => {
    expect(profileCollectionUrl("alice", "shares", 3)).toBe("/api/users/alice/public-profile?section=shares&page=3");
    expect(profileCollectionUrl("中文 用户", "songs", 1)).toBe(
      "/api/users/%E4%B8%AD%E6%96%87%20%E7%94%A8%E6%88%B7/public-profile?section=songs&page=1"
    );
    expect(profileCollectionUrl("alice", "pools", 0)).toBe("/api/users/alice/public-profile?section=pools&page=1");
  });
});

describe("profile usernames", () => {
  it("decodes percent-escaped and raw usernames", () => {
    expect(decodeProfileUsername("%E4%B8%AD%E6%96%87")).toBe("中文");
    expect(decodeProfileUsername("中文")).toBe("中文");
    expect(decodeProfileUsername("100%")).toBe("100%");
  });

  it("builds an encoded profile path for names with spaces and symbols", () => {
    expect(profilePath("中文 用户")).toBe("/u/%E4%B8%AD%E6%96%87%20%E7%94%A8%E6%88%B7");
    expect(profilePath("a&b")).toBe("/u/a%26b");
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

  it("renders an error state with a retry action", () => {
    expect(source).toContain("加载失败");
    expect(source).toContain("重新加载");
    expect(source).toContain("重试");
  });

  it("shows the display name and a short, timezone-stable membership date", () => {
    expect(source).toContain("displayName");
    expect(source).toContain("getUTCFullYear()");
    expect(source).toContain("月加入");
  });

  it("falls back to the first letter when the avatar image fails", () => {
    expect(source).toContain("avatarFailed");
    expect(source).toContain("onError");
    expect(source).toContain("displayName.slice(0, 1)");
  });

  it("puts the share action in the profile header, before the collection section", () => {
    const shareIndex = source.indexOf("分享主页");
    const sectionIndex = source.indexOf("公开作品");
    expect(shareIndex).toBeGreaterThan(-1);
    expect(sectionIndex).toBeGreaterThan(-1);
    expect(shareIndex).toBeLessThan(sectionIndex);
    expect(source).toContain("copyTextWithFallback");
    expect(source).toContain("手动复制主页网址");
  });

  it("keeps five categories without redundant statistic cards", () => {
    expect(source).toContain('{ value: "pools", label: "番组", count: profile.stats.publicPoolsCount }');
    expect(source).toContain('{ value: "shares", label: "动画榜单", count: profile.stats.sharedTierListCount }');
    expect(source).toContain('{ value: "songs", label: "音乐曲单", count: profile.stats.publicSongPlaylistsCount }');
    expect(source).toContain('{ value: "songTiers", label: "音乐榜单", count: profile.stats.sharedSongTierListCount }');
    expect(source).toContain('{ value: "taste", label: "口味" }');
    expect(source).toContain("profile.stats.participatedPoolCount");
    expect(source).not.toContain('aria-label="个人公开作品统计"');
  });

  it("defaults to the public pools tab and keeps taste last", () => {
    expect(source).toContain('useState<PublicTab>("pools")');
    const tasteTabIndex = source.indexOf('{ value: "taste", label: "口味" }');
    expect(tasteTabIndex).toBeGreaterThan(source.indexOf('{ value: "pools", label: "番组"'));
  });

  it("resets to page one on tab change and clamps stale pages", () => {
    expect(source).toContain("setContentTab(tab); setContentPage(1);");
    expect(source).toContain("profilePageCount(");
  });

  it("scrolls back to the collection after a page change once the new list is rendered", () => {
    expect(source).toContain("scrollOnNextContent");
    expect(source).toContain("scrollIntoView");
  });

  it("aborts superseded requests so slow tabs cannot overwrite the active one", () => {
    expect(source).toContain("AbortController");
    expect(source).toContain("controller.abort()");
    expect(source).toContain("controller.signal.aborted");
    expect(source).toContain("profileCollectionUrl(");
  });

  it("uses the site-wide width and does not nest a second main", () => {
    expect(source).toContain("PageShell");
    expect(source).not.toContain("max-w-4xl");
    expect(source).not.toContain("<main");
  });

  it("keeps the taste dashboard mounted behind its own tab", () => {
    expect(source).toContain('contentTab === "taste"');
    expect(source).toContain("<TasteDashboard username={username} />");
  });

  it("links every card to its real detail page", () => {
    expect(source).toContain('"/pools/" + pool.id');
    expect(source).toContain('"/share/tier/" + tl.token');
    expect(source).toContain('"/anisong/templates/" + song.id');
    expect(source).toContain('"/anisong/share/" + song.token');
  });

  it("uses proxyExternalImageUrl for covers and avatars", () => {
    expect(source).toContain("proxyExternalImageUrl");
  });

  it("renders cover images with a plain img so COS/CDN hosts skip the Next optimizer", () => {
    // next.config only allows bangumi hosts for the optimizer; COS covers would 400.
    expect(source).not.toContain('from "next/image"');
    expect(source).toContain('loading="lazy"');
    expect(source).toContain("referrerPolicy=\"no-referrer\"");
    expect(source).toContain("onError={() => setFailed");
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
