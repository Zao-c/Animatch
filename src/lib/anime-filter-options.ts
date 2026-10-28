export const ANIME_FORMAT_OPTIONS = [
  { value: "TV", label: "TV 电视动画" },
  { value: "MOVIE", label: "剧场版 / 动画电影" },
  { value: "OVA", label: "OVA / OAD" },
  { value: "WEB", label: "WEB / ONA 网络动画" },
  { value: "SPECIAL", label: "特别篇 / SP" }
];

export function animeFormatAliases(type: string): string[] {
  if (type === "WEB" || type === "ONA") return ["WEB", "ONA"];
  if (type === "SPECIAL" || type === "SP") return ["SPECIAL", "SP"];
  if (type === "OVA" || type === "OAD") return ["OVA", "OAD"];
  return [type];
}

export function bangumiFormatTag(type?: string): string | undefined {
  return ({ TV: "TV", MOVIE: "剧场版", OVA: "OVA", WEB: "WEB", ONA: "WEB", SPECIAL: "SP" } as Record<string, string>)[type ?? ""];
}

/** Half-open UTC bounds include all days, including leap days and December. */
export function animeMonthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1))
  };
}
