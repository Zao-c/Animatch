import { describe, expect, it } from "vitest";
import {
  rankAnimeSearchResults,
  scoreAnimeSearchResult,
  type AnimeSearchScoringFields,
} from "../src/lib/anime-service";

function anime(
  input: Partial<AnimeSearchScoringFields> & Pick<AnimeSearchScoringFields, "title">
): AnimeSearchScoringFields {
  return {
    title: input.title,
    titleCn: input.titleCn ?? null,
    titleJa: input.titleJa ?? null,
    titleEn: input.titleEn ?? null,
    aliases: input.aliases ?? [],
    animeType: input.animeType ?? "UNKNOWN",
    episodes: input.episodes ?? null,
    bangumiScore: input.bangumiScore ?? null,
    year: input.year ?? null,
    rawJson: input.rawJson ?? null,
  };
}

describe("anime search ranking", () => {
  it("ranks Attack on Titan main entries above recap shorts for Chinese search", () => {
    const main = anime({
      title: "Attack on Titan",
      titleJa: "進撃の巨人",
      aliases: ["进击的巨人", "Shingeki no Kyojin"],
      animeType: "TV",
      episodes: 25,
      rawJson: { score: { arithmeticGeometricMean: 8.5 } },
      year: 2013,
    });
    const recap = anime({
      title: "10分で追いつける！アニメ「進撃の巨人」",
      aliases: ["進撃の巨人"],
      animeType: "SPECIAL",
      episodes: 1,
      rawJson: { score: { arithmeticGeometricMean: 7.8 } },
      year: 2023,
    });

    expect(rankAnimeSearchResults([recap, main], "进击的巨人")[0]).toBe(main);
    expect(scoreAnimeSearchResult(recap, "进击的巨人")).toBeLessThan(
      scoreAnimeSearchResult(main, "进击的巨人")
    );
  });

  it("ranks Spy x Family main entries above Ayataka campaigns", () => {
    const main = anime({
      title: "Spy x Family",
      titleCn: "间谍过家家",
      aliases: ["SPY×FAMILY"],
      animeType: "TV",
      episodes: 12,
      rawJson: { score: { arithmeticGeometricMean: 8.6 } },
      year: 2022,
    });
    const campaign = anime({
      title: "Ayataka Spy x Family Movie Campaign Ayataka de Hotto Hitoiki",
      aliases: ["间谍过家家"],
      animeType: "ONA",
      episodes: 1,
      rawJson: { score: { arithmeticGeometricMean: 8.7 } },
      year: 2023,
    });

    expect(rankAnimeSearchResults([campaign, main], "间谍过家家")[0]).toBe(main);
    expect(scoreAnimeSearchResult(campaign, "Spy Family")).toBeLessThan(
      scoreAnimeSearchResult(main, "Spy Family")
    );
  });

  it("ranks One Piece main entries above original episode shorts", () => {
    const main = anime({
      title: "One Piece",
      titleCn: "海贼王",
      aliases: ["航海王"],
      animeType: "TV",
      episodes: 1000,
      rawJson: { score: { arithmeticGeometricMean: 8.4 } },
      year: 1999,
    });
    const short = anime({
      title: "Anime One Piece Original Episode / Luffy, Law",
      aliases: ["海贼王"],
      animeType: "SPECIAL",
      episodes: 1,
      rawJson: { score: { arithmeticGeometricMean: 8.5 } },
      year: 2021,
    });

    expect(rankAnimeSearchResults([short, main], "海贼王")[0]).toBe(main);
  });

  it("keeps English search terms effective", () => {
    expect(scoreAnimeSearchResult(anime({ title: "Attack on Titan", animeType: "TV" }), "Attack on Titan")).toBeGreaterThan(0);
    expect(scoreAnimeSearchResult(anime({ title: "Spy x Family", animeType: "TV" }), "Spy Family")).toBeGreaterThan(0);
    expect(scoreAnimeSearchResult(anime({ title: "One Piece", animeType: "TV" }), "One Piece")).toBeGreaterThan(0);
  });

  it("keeps Chinese alias searches effective", () => {
    expect(
      scoreAnimeSearchResult(
        anime({ title: "Attack on Titan", aliases: ["进击的巨人"], animeType: "TV" }),
        "进击的巨人"
      )
    ).toBeGreaterThan(0);
    expect(
      scoreAnimeSearchResult(
        anime({ title: "Spy x Family", aliases: ["间谍过家家"], animeType: "TV" }),
        "间谍过家家"
      )
    ).toBeGreaterThan(0);
    expect(
      scoreAnimeSearchResult(
        anime({ title: "One Piece", aliases: ["海贼王"], animeType: "TV" }),
        "海贼王"
      )
    ).toBeGreaterThan(0);
  });
});
