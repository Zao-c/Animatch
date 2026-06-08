import { describe, expect, it } from "vitest";
import { toTierListItem } from "../src/lib/tier-service";

describe("tier-service mapping", () => {
  it("maps score with anime to public tier list item without rawJson", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const item = toTierListItem({
      id: "score-1",
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1",
      animeId: "anime-1",
      eloScore: 1510,
      uncertainty: 300,
      compareCount: 2,
      winCount: 1,
      lossCount: 0,
      drawCount: 1,
      unseenCount: 0,
      skipCount: 0,
      isHidden: false,
      manualTier: null,
      manualRank: null,
      manualLocked: false,
      lastComparedAt: now,
      createdAt: now,
      updatedAt: now,
      anime: {
        id: "anime-1",
        bgmId: 876,
        title: "Title",
        titleCn: "中文名",
        summary: "hidden summary",
        imageUrl: "common.jpg",
        imageSmallUrl: "small.jpg",
        imageMediumUrl: "medium.jpg",
        imageLargeUrl: "large.jpg",
        airDate: now,
        bangumiRank: 10,
        bangumiScore: 8.5,
        bangumiVotes: 1000,
        tags: ["tag"],
        rawJson: { private: true },
        fetchedAt: now,
        imageStatus: "OK",
        imageCheckedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
    });

    expect(item).toMatchObject({
      id: "anime-1",
      animeId: "anime-1",
      bgmId: 876,
      title: "Title",
      eloScore: 1510,
      compareCount: 2,
      winCount: 1
    });
    expect("rawJson" in item).toBe(false);
    expect("summary" in item).toBe(false);
  });
});
