export type AnimeTagGroup =
  | "类型"
  | "场景"
  | "氛围"
  | "题材"
  | "形式"
  | "年代"
  | "来源"
  | "状态";

export interface AnimeTagDictionaryEntry {
  key: string;
  label: string;
  aliases: string[];
  group: AnimeTagGroup;
  weight: number;
}

export const ANIME_TAG_DICTIONARY: AnimeTagDictionaryEntry[] = [
  {
    key: "romance",
    label: "恋爱",
    aliases: ["爱情", "感情线", "恋爱番", "爱情番", "love"],
    group: "题材",
    weight: 100,
  },
  {
    key: "school",
    label: "校园",
    aliases: ["学园", "学校", "校园番", "学生", "高中"],
    group: "场景",
    weight: 98,
  },
  {
    key: "comedy",
    label: "喜剧",
    aliases: ["搞笑", "欢乐", "幽默"],
    group: "氛围",
    weight: 96,
  },
  {
    key: "fantasy",
    label: "奇幻",
    aliases: ["幻想", "魔幻", "架空"],
    group: "题材",
    weight: 94,
  },
  {
    key: "action",
    label: "战斗",
    aliases: ["动作", "打斗", "热血", "战斗番"],
    group: "类型",
    weight: 92,
  },
  {
    key: "slice of life",
    label: "日常",
    aliases: ["生活", "日常系", "治愈日常", "slice-of-life", "slice_of_life"],
    group: "氛围",
    weight: 90,
  },
  {
    key: "mystery",
    label: "悬疑",
    aliases: ["推理", "谜题", "解谜"],
    group: "题材",
    weight: 88,
  },
  {
    key: "sci-fi",
    label: "科幻",
    aliases: ["科幻", "science fiction", "sci fi", "sf", "未来"],
    group: "题材",
    weight: 86,
  },
  {
    key: "isekai",
    label: "异世界",
    aliases: ["穿越", "转生", "异界"],
    group: "题材",
    weight: 84,
  },
  {
    key: "sports",
    label: "运动",
    aliases: ["体育", "竞技", "比赛"],
    group: "类型",
    weight: 82,
  },
  {
    key: "idol",
    label: "偶像",
    aliases: ["偶像番", "爱豆", "idol"],
    group: "题材",
    weight: 80,
  },
  {
    key: "mecha",
    label: "机甲",
    aliases: ["机器人", "萝卜", "机械"],
    group: "题材",
    weight: 78,
  },
  {
    key: "adventure",
    label: "冒险",
    aliases: ["探险", "旅程", "旅行"],
    group: "类型",
    weight: 76,
  },
  {
    key: "drama",
    label: "剧情",
    aliases: ["剧情向", "正剧", "戏剧"],
    group: "类型",
    weight: 74,
  },
  {
    key: "supernatural",
    label: "超自然",
    aliases: ["灵异", "怪异", "妖怪", "超能力"],
    group: "题材",
    weight: 72,
  },
  {
    key: "music",
    label: "音乐",
    aliases: ["乐队", "歌曲", "演奏"],
    group: "题材",
    weight: 70,
  },
  {
    key: "historical",
    label: "历史",
    aliases: ["历史剧", "古代", "时代剧"],
    group: "年代",
    weight: 68,
  },
  {
    key: "horror",
    label: "恐怖",
    aliases: ["惊悚恐怖", "吓人", "怪谈"],
    group: "氛围",
    weight: 66,
  },
  {
    key: "psychological",
    label: "心理",
    aliases: ["心理战", "精神", "意识流"],
    group: "题材",
    weight: 64,
  },
  {
    key: "thriller",
    label: "惊悚",
    aliases: ["紧张", "悬念", "惊险"],
    group: "氛围",
    weight: 62,
  },
  {
    key: "magic",
    label: "魔法",
    aliases: ["魔术", "法术", "魔女"],
    group: "题材",
    weight: 60,
  },
  {
    key: "military",
    label: "军事",
    aliases: ["军队", "战争", "军武"],
    group: "题材",
    weight: 58,
  },
  {
    key: "game",
    label: "游戏",
    aliases: ["电竞", "网游", "桌游"],
    group: "题材",
    weight: 56,
  },
  {
    key: "movie",
    label: "剧场版",
    aliases: ["电影", "动画电影", "movie"],
    group: "形式",
    weight: 54,
  },
  {
    key: "ova",
    label: "OVA",
    aliases: ["原创动画录影带"],
    group: "形式",
    weight: 52,
  },
  {
    key: "tv",
    label: "TV动画",
    aliases: ["tv动画", "电视动画", "番剧", "TV"],
    group: "形式",
    weight: 50,
  },
];

const KEY_TO_ENTRY = new Map(
  ANIME_TAG_DICTIONARY.map((entry) => [normalizeTagKey(entry.key), entry])
);

const ALIAS_TO_ENTRY = new Map<string, AnimeTagDictionaryEntry>();

for (const entry of ANIME_TAG_DICTIONARY) {
  for (const value of [entry.key, entry.label, ...entry.aliases]) {
    ALIAS_TO_ENTRY.set(normalizeTagKey(value), entry);
  }
}

export function normalizeTagKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[＿_]+/g, " ")
    .replace(/[-‐‑‒–—]+/g, " ")
    .replace(/\s+/g, " ");
}

export function labelAnimeTag(tag: string): string {
  const normalized = normalizeTagKey(tag);
  return KEY_TO_ENTRY.get(normalized)?.label ?? ALIAS_TO_ENTRY.get(normalized)?.label ?? tag;
}

export function expandTagQuery(query: string): string[] {
  const normalized = normalizeTagKey(query);
  if (!normalized) return [];

  const entry = ALIAS_TO_ENTRY.get(normalized) ?? KEY_TO_ENTRY.get(normalized);
  if (entry === undefined) return [normalized];

  return uniqueNormalized([entry.key, entry.label, ...entry.aliases]);
}

export function matchTagAliases(query: string): string | null {
  const normalized = normalizeTagKey(query);
  if (!normalized) return null;
  return (ALIAS_TO_ENTRY.get(normalized) ?? KEY_TO_ENTRY.get(normalized))?.key ?? null;
}

export function getPopularTagOptions(limit = 16): AnimeTagDictionaryEntry[] {
  return [...ANIME_TAG_DICTIONARY]
    .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label))
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export function getTagGroupLabel(group: AnimeTagGroup): string {
  return group;
}

function uniqueNormalized(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeTagKey(value))
        .filter(Boolean)
    )
  );
}
