import { fromError, notFound, ok } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import type { SongDocument, SongSnapshot } from "@/lib/anisong/types";

interface RouteContext {
  params: { username: string };
}

export const PROFILE_PAGE_SIZE = 9;
type ProfileSection = "pools" | "tiers" | "songs" | "songTiers";

function toCoverStrip(
  animes: Array<{
    imageUrl: string | null;
    imageSmallUrl: string | null;
    imageMediumUrl: string | null;
    imageLargeUrl: string | null;
    thumbnailUrl: string | null;
    coverEnabled?: boolean;
  }>,
  maxCount = 5
): string[] {
  return animes
    .slice(0, maxCount)
    .map((a) => getAnimeCoverUrl(a, { intent: "display" }))
    .filter((u): u is string => u !== null && u.length > 0);
}

function safeSongCovers(urls: Array<string | null | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url?.trim())))].slice(0, 5);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { username } = context.params;
    const params = new URL(request.url).searchParams;
    const requestedSection = params.get("section") === "shares" ? "tiers" : params.get("section");
    const section: ProfileSection =
      requestedSection === "tiers" || requestedSection === "songs" || requestedSection === "songTiers"
        ? requestedSection
        : "pools";
    const requestedPage = Number(params.get("page") ?? "1");
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(10000, requestedPage) : 1;
    const skip = (page - 1) * PROFILE_PAGE_SIZE;

    const user = await prisma.user.findFirst({
      where: { username, deletedAt: null },
      select: {
        id: true,
        username: true,
        name: true,
        image: true,
        createdAt: true
      }
    });
    if (user === null) return notFound("用户不存在");

    const publicPoolWhere = { creatorId: user.id, visibility: "PUBLIC" as const, deletedAt: null };
    const publicSongWhere = { ownerId: user.id, active: true };
    const sharedSongTierWhere = { ownerId: user.id, shareToken: { not: null } };
    const [
      publicPoolsCount,
      sharedTierListCount,
      participatedPools,
      publicSongPlaylistsCount,
      sharedSongTierListCount
    ] = await Promise.all([
      prisma.customPool.count({ where: publicPoolWhere }),
      prisma.tierShare.count({ where: { run: { userId: user.id } } }),
      prisma.userPoolScore.groupBy({ by: ["poolId"], where: { userId: user.id } }),
      prisma.songTemplate.count({ where: publicSongWhere }),
      prisma.songBoard.count({ where: sharedSongTierWhere })
    ]);

    const publicPools: Array<{
      id: string; name: string; description: string | null; animeCount: number;
      tierListCount: number; coverUrls: string[]; createdAt: string; updatedAt: string;
    }> = [];
    const publicTierLists: Array<{
      token: string; title: string; poolName: string; animeCount: number;
      comparisonCount: number; coverUrls: string[]; createdAt: string;
    }> = [];
    const publicSongPlaylists: Array<{
      id: string; title: string; trackCount: number; coverUrls: string[]; updatedAt: string;
    }> = [];
    const publicSongTierLists: Array<{
      token: string; title: string; trackCount: number; comparisonCount: number;
      coverUrls: string[]; updatedAt: string;
    }> = [];

    if (section === "pools") {
      const rows = await prisma.customPool.findMany({
        where: publicPoolWhere,
        include: {
          poolAnime: { include: { anime: true }, take: 5, orderBy: { position: "asc" } },
          _count: { select: { poolAnime: true, personalRuns: true } }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: PROFILE_PAGE_SIZE
      });
      publicPools.push(...rows.map(pool => ({
        id: pool.id, name: pool.name, description: pool.description,
        animeCount: pool._count.poolAnime, tierListCount: pool._count.personalRuns,
        coverUrls: toCoverStrip(pool.poolAnime.map(item => item.anime)),
        createdAt: pool.createdAt.toISOString(), updatedAt: pool.updatedAt.toISOString()
      })));
    } else if (section === "tiers") {
      const rows = await prisma.tierShare.findMany({
        where: { run: { userId: user.id } },
        include: { run: { select: { pool: { select: { id: true, name: true } } } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: PROFILE_PAGE_SIZE
      });
      publicTierLists.push(...rows.map(ts => {
        const snapshot = ts.snapshot as Record<string, unknown>;
        const tiers = (snapshot?.tiers as unknown[]) ?? [];
        const items = tiers.flatMap(tier => (tier as { items?: unknown[] })?.items ?? []) as Array<Record<string, unknown>>;
        return {
          token: ts.token, title: ts.title,
          poolName: ts.run?.pool?.name ?? "未知番组",
          animeCount: typeof snapshot?.animeCount === "number" ? snapshot.animeCount : items.length,
          comparisonCount: typeof snapshot?.comparisonCount === "number" ? snapshot.comparisonCount : 0,
          coverUrls: toCoverStrip(items.slice(0, 5).map(item => ({
            imageUrl: (item?.imageUrl as string | null) ?? null,
            imageSmallUrl: (item?.imageSmallUrl as string | null) ?? null,
            imageMediumUrl: (item?.imageMediumUrl as string | null) ?? null,
            imageLargeUrl: (item?.imageLargeUrl as string | null) ?? null,
            thumbnailUrl: (item?.thumbnailUrl as string | null) ?? null
          }))),
          createdAt: ts.createdAt.toISOString()
        };
      }));
    } else if (section === "songs") {
      // Never return private song boards, unpublished audio, credentials, or playback URLs.
      const rows = await prisma.songTemplate.findMany({
        where: publicSongWhere, select: {
          id: true, title: true, document: true, updatedAt: true
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: PROFILE_PAGE_SIZE
      });
      publicSongPlaylists.push(...rows.map(template => {
        const document = template.document as unknown as SongDocument;
        return {
          id: template.id, title: template.title,
          trackCount: document.tracks.length,
          coverUrls: safeSongCovers(document.tracks.map(track => track.coverUrl)),
          updatedAt: template.updatedAt.toISOString()
        };
      }));
    } else if (section === "songTiers") {
      // A share token is an explicit public music Tier snapshot, independent of playlist visibility.
      const rows = await prisma.songBoard.findMany({
        where: sharedSongTierWhere, select: {
          shareToken: true, title: true, snapshot: true, updatedAt: true
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: PROFILE_PAGE_SIZE
      });
      publicSongTierLists.push(...rows.filter(board => board.shareToken && board.snapshot).map(board => {
        const snapshot = board.snapshot as unknown as SongSnapshot;
        const songs = snapshot.rows.flatMap(row => row.songs);
        return {
          token: board.shareToken!, title: snapshot.title || board.title,
          trackCount: songs.length, comparisonCount: snapshot.comparisons,
          coverUrls: safeSongCovers(songs.map(song => song.coverUrl)),
          updatedAt: board.updatedAt.toISOString()
        };
      }));
    }

    const totals = {
      pools: publicPoolsCount,
      tiers: sharedTierListCount,
      songs: publicSongPlaylistsCount,
      songTiers: sharedSongTierListCount
    };
    return ok({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt.toISOString()
      },
      stats: {
        publicPoolsCount, sharedTierListCount,
        participatedPoolCount: participatedPools.length,
        publicSongPlaylistsCount, sharedSongTierListCount
      },
      publicPools, publicTierLists, publicSongPlaylists, publicSongTierLists,
      pagination: { section, page, pageSize: PROFILE_PAGE_SIZE, total: totals[section] }
    }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    return fromError(error);
  }
}
