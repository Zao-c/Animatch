import { PoolStatus, Visibility, type Anime, type CustomPool } from "@prisma/client";
import { prisma } from "./db";
import { ANIME_SOURCE } from "./anime-source";

export const DEMO_POOL_NAME = "AniMatch 入门体验池";
export const DEMO_POOL_DESCRIPTION =
  "不用搜索和导入，直接体验二选一对决、Tier List、校准和分享。";
export const DEMO_POOL_TAG = "animatch-demo-v1";
export const OFFICIAL_DEMO_USERNAME = "animatch-official-demo";

const DEMO_ANIME = [
  {
    bgmId: -900001,
    title: "Hyouka",
    titleCn: "冰菓",
    airDate: "2012-04-22T00:00:00.000Z",
    bangumiScore: 8.1,
    bangumiRank: 120,
    tags: ["校园", "推理", "日常"],
    cover: "/demo-covers/hyouka.svg"
  },
  {
    bgmId: -900002,
    title: "CLANNAD",
    titleCn: "CLANNAD",
    airDate: "2007-10-04T00:00:00.000Z",
    bangumiScore: 8.0,
    bangumiRank: 150,
    tags: ["校园", "恋爱", "Key"],
    cover: "/demo-covers/clannad.svg"
  },
  {
    bgmId: -900003,
    title: "K-ON!",
    titleCn: "轻音少女",
    airDate: "2009-04-02T00:00:00.000Z",
    bangumiScore: 7.9,
    bangumiRank: 180,
    tags: ["音乐", "日常", "校园"],
    cover: "/demo-covers/k-on.svg"
  },
  {
    bgmId: -900004,
    title: "Steins;Gate",
    titleCn: "命运石之门",
    airDate: "2011-04-06T00:00:00.000Z",
    bangumiScore: 8.7,
    bangumiRank: 20,
    tags: ["科幻", "悬疑", "时间旅行"],
    cover: "/demo-covers/steins-gate.svg"
  },
  {
    bgmId: -900005,
    title: "Puella Magi Madoka Magica",
    titleCn: "魔法少女小圆",
    airDate: "2011-01-07T00:00:00.000Z",
    bangumiScore: 8.4,
    bangumiRank: 60,
    tags: ["魔法少女", "原创", "剧情"],
    cover: "/demo-covers/madoka.svg"
  },
  {
    bgmId: -900006,
    title: "Violet Evergarden",
    titleCn: "紫罗兰永恒花园",
    airDate: "2018-01-11T00:00:00.000Z",
    bangumiScore: 8.0,
    bangumiRank: 170,
    tags: ["治愈", "奇幻", "京阿尼"],
    cover: "/demo-covers/violet.svg"
  },
  {
    bgmId: -900007,
    title: "Frieren: Beyond Journey's End",
    titleCn: "葬送的芙莉莲",
    airDate: "2023-09-29T00:00:00.000Z",
    bangumiScore: 8.6,
    bangumiRank: 30,
    tags: ["奇幻", "冒险", "旅行"],
    cover: "/demo-covers/frieren.svg"
  },
  {
    bgmId: -900008,
    title: "Bocchi the Rock!",
    titleCn: "孤独摇滚",
    airDate: "2022-10-09T00:00:00.000Z",
    bangumiScore: 8.3,
    bangumiRank: 80,
    tags: ["音乐", "喜剧", "乐队"],
    cover: "/demo-covers/bocchi.svg"
  },
  {
    bgmId: -900009,
    title: "Attack on Titan",
    titleCn: "进击的巨人",
    airDate: "2013-04-07T00:00:00.000Z",
    bangumiScore: 8.2,
    bangumiRank: 100,
    tags: ["战斗", "剧情", "热血"],
    cover: "/demo-covers/attack-on-titan.svg"
  },
  {
    bgmId: -900010,
    title: "Your Lie in April",
    titleCn: "四月是你的谎言",
    airDate: "2014-10-10T00:00:00.000Z",
    bangumiScore: 7.8,
    bangumiRank: 240,
    tags: ["音乐", "恋爱", "青春"],
    cover: "/demo-covers/your-lie-in-april.svg"
  }
] as const;

export interface DemoPoolResult {
  poolId: string;
  created: boolean;
  animeCount: number;
  redirectTo: string;
  isOfficialDemo: boolean;
}

export async function getOrCreateDemoPool(_userId: string): Promise<DemoPoolResult> {
  return getOrCreateOfficialDemoPool();
}

export async function getOrCreateOfficialDemoPool(): Promise<DemoPoolResult> {
  const existingPool = await prisma.customPool.findFirst({
    where: {
      isOfficialDemo: true,
      status: {
        not: PoolStatus.ARCHIVED
      },
      deletedAt: null
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (existingPool !== null) {
    return serializeExistingDemoPoolResult(existingPool);
  }

  const anime = await ensureDemoAnime();
  const owner = await prisma.user.upsert({
    where: {
      username: OFFICIAL_DEMO_USERNAME
    },
    create: {
      username: OFFICIAL_DEMO_USERNAME,
      name: "AniMatch Official Demo"
    },
    update: {
      name: "AniMatch Official Demo"
    }
  });
  const pool =
    existingPool ??
    (await prisma.customPool.create({
      data: {
        creatorId: owner.id,
        name: DEMO_POOL_NAME,
        description: DEMO_POOL_DESCRIPTION,
        visibility: Visibility.PUBLIC,
        tags: [DEMO_POOL_TAG, "示例池"],
        affectsGlobalTaste: false,
        allowPublicEdit: true,
        allowCommunityMatch: false,
        isOfficialDemo: true
      }
    }));

  await ensurePoolAnime(pool, anime);

  return serializeDemoPoolResult({
    pool,
    created: true,
    animeCount: anime.length
  });
}

async function serializeExistingDemoPoolResult(
  pool: CustomPool
): Promise<DemoPoolResult> {
  const existingEntries = await prisma.poolAnime.findMany({
    where: {
      poolId: pool.id
    },
    select: {
      animeId: true
    }
  });

  return serializeDemoPoolResult({
    pool,
    created: false,
    animeCount: existingEntries.length
  });
}

async function ensureDemoAnime(): Promise<Anime[]> {
  const anime: Anime[] = [];

  for (const item of DEMO_ANIME) {
    anime.push(
      await prisma.anime.upsert({
        where: {
          bgmId: item.bgmId
        },
        create: {
          bgmId: item.bgmId,
          title: item.title,
          titleCn: item.titleCn,
          imageUrl: null,
          imageSmallUrl: null,
          imageMediumUrl: null,
          imageLargeUrl: null,
          thumbnailUrl: null,
          airDate: new Date(item.airDate),
          bangumiRank: item.bangumiRank,
          bangumiScore: item.bangumiScore,
          tags: [...item.tags],
          aliases: [item.titleCn],
          studios: [],
          externalLinks: [],
          source: ANIME_SOURCE.DEMO,
          sourceId: `demo/${Math.abs(item.bgmId)}`,
          imageStatus: "MISSING"
        },
        update: {
          title: item.title,
          titleCn: item.titleCn,
          airDate: new Date(item.airDate),
          bangumiRank: item.bangumiRank,
          bangumiScore: item.bangumiScore,
          tags: [...item.tags],
          aliases: [item.titleCn],
          studios: [],
          externalLinks: [],
          source: ANIME_SOURCE.DEMO,
          sourceId: `demo/${Math.abs(item.bgmId)}`
        }
      })
    );
  }

  return anime;
}

async function ensurePoolAnime(pool: CustomPool, anime: Anime[]) {
  const existingEntries = await prisma.poolAnime.findMany({
    where: {
      poolId: pool.id
    },
    select: {
      animeId: true,
      position: true
    }
  });
  const existingAnimeIds = new Set(existingEntries.map((entry) => entry.animeId));
  let nextPosition =
    existingEntries.reduce((max, entry) => Math.max(max, entry.position), 0) + 1;

  for (const item of anime) {
    if (existingAnimeIds.has(item.id)) {
      continue;
    }

    await prisma.poolAnime.create({
      data: {
        poolId: pool.id,
        animeId: item.id,
        position: nextPosition
      }
    });
    nextPosition += 1;
  }
}

function serializeDemoPoolResult(input: {
  pool: CustomPool;
  created: boolean;
  animeCount: number;
}): DemoPoolResult {
  return {
    poolId: input.pool.id,
    created: input.created,
    animeCount: input.animeCount,
    redirectTo: `/pools/${input.pool.id}`,
    isOfficialDemo: true
  };
}
