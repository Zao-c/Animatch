export interface TierRowConfig {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface PoolTierConfig {
  version: 1;
  rows: TierRowConfig[];
}

export const DEFAULT_TIER_CONFIG: PoolTierConfig = {
  version: 1,
  rows: [
    { id: "s", label: "S", color: "#ff747c", order: 0 },
    { id: "a", label: "A", color: "#ffc078", order: 1 },
    { id: "b", label: "B", color: "#ffe082", order: 2 },
    { id: "c", label: "C", color: "#b6ff73", order: 3 },
    { id: "d", label: "D", color: "#70f475", order: 4 }
  ]
};

export const TIER_TEMPLATES: Record<string, TierRowConfig[]> = {
  standard: [
    { id: "s", label: "S", color: "#ff747c", order: 0 },
    { id: "a", label: "A", color: "#ffc078", order: 1 },
    { id: "b", label: "B", color: "#ffe082", order: 2 },
    { id: "c", label: "C", color: "#b6ff73", order: 3 },
    { id: "d", label: "D", color: "#70f475", order: 4 }
  ],
  extended: [
    { id: "ss", label: "SS", color: "#ff5252", order: 0 },
    { id: "s", label: "S", color: "#ff747c", order: 1 },
    { id: "a", label: "A", color: "#ffc078", order: 2 },
    { id: "b", label: "B", color: "#ffe082", order: 3 },
    { id: "c", label: "C", color: "#b6ff73", order: 4 },
    { id: "d", label: "D", color: "#70f475", order: 5 }
  ],
  chinese: [
    { id: "s", label: "神作", color: "#ff747c", order: 0 },
    { id: "a", label: "优秀", color: "#ffc078", order: 1 },
    { id: "b", label: "不错", color: "#ffe082", order: 2 },
    { id: "c", label: "一般", color: "#b6ff73", order: 3 },
    { id: "d", label: "不喜欢", color: "#70f475", order: 4 }
  ],
  simple: [
    { id: "like", label: "喜欢", color: "#ff747c", order: 0 },
    { id: "meh", label: "一般", color: "#ffe082", order: 1 },
    { id: "dislike", label: "不喜欢", color: "#70f475", order: 2 }
  ]
};

export const COLOR_PALETTE = [
  "#ff5252",
  "#ff747c",
  "#ff8a80",
  "#ffc078",
  "#ffe082",
  "#b6ff73",
  "#70f475",
  "#69f0ae",
  "#40c4ff",
  "#82b1ff",
  "#b388ff",
  "#ea80fc"
];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_LABEL_CHARS = 12;

export function normalizeTierConfig(
  input: unknown
): { ok: true; config: PoolTierConfig } | { ok: false; error: string } {
  if (input === null || input === undefined) {
    return { ok: true, config: DEFAULT_TIER_CONFIG };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "tierConfig 必须是对象。" };
  }

  const obj = input as Record<string, unknown>;

  if (obj.version !== 1) {
    return { ok: false, error: "不支持的 tierConfig 版本。" };
  }

  if (!Array.isArray(obj.rows)) {
    return { ok: false, error: "tierConfig.rows 必须是数组。" };
  }

  const rawRows = obj.rows as unknown[];

  if (rawRows.length < 2) {
    return { ok: false, error: "至少需要 2 行。" };
  }

  if (rawRows.length > 7) {
    return { ok: false, error: "最多支持 7 行。" };
  }

  const rows: TierRowConfig[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i] as Record<string, unknown> | null | undefined;

    if (r === null || r === undefined || typeof r !== "object") {
      return { ok: false, error: `rows[${i}] 不是有效对象。` };
    }

    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (id.length === 0) {
      return { ok: false, error: `rows[${i}].id 不能为空。` };
    }
    if (!ID_PATTERN.test(id)) {
      return {
        ok: false,
        error: `rows[${i}].id "${id}" 只允许小写字母、数字和连字符。`
      };
    }
    if (seenIds.has(id)) {
      return { ok: false, error: `重复的 row id "${id}"。` };
    }
    seenIds.add(id);

    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (label.length === 0) {
      return { ok: false, error: `rows[${i}].label 不能为空。` };
    }
    if (label.length > MAX_LABEL_CHARS) {
      return {
        ok: false,
        error: `rows[${i}].label 不能超过 ${MAX_LABEL_CHARS} 个字符。`
      };
    }

    const color = typeof r.color === "string" ? r.color.trim() : "";
    if (!COLOR_PATTERN.test(color)) {
      return { ok: false, error: `rows[${i}].color "${color}" 必须是 #RRGGBB 格式。` };
    }

    rows.push({ id, label, color, order: i });
  }

  rows.sort((a, b) => a.order - b.order);
  for (let i = 0; i < rows.length; i++) {
    rows[i].order = i;
  }

  return { ok: true, config: { version: 1, rows } };
}

export function resolveTierRows(
  poolTierConfig: PoolTierConfig | null | undefined
): TierRowConfig[] {
  if (poolTierConfig === null || poolTierConfig === undefined) {
    return DEFAULT_TIER_CONFIG.rows;
  }

  const result = normalizeTierConfig(poolTierConfig);
  if (!result.ok) {
    return DEFAULT_TIER_CONFIG.rows;
  }

  return result.config.rows;
}

export function isValidTierId(
  tierId: string | null | undefined,
  rows: TierRowConfig[]
): boolean {
  if (tierId === null || tierId === undefined || tierId.length === 0) {
    return false;
  }

  const lower = tierId.toLowerCase();
  return rows.some((r) => r.id === lower);
}

export function matchTierRow(
  tierId: string | null | undefined,
  rows: TierRowConfig[]
): TierRowConfig | undefined {
  if (tierId === null || tierId === undefined || tierId.length === 0) {
    return undefined;
  }

  const lower = tierId.toLowerCase();
  return rows.find((r) => r.id === lower);
}

export function isDefaultFiveRows(rows: TierRowConfig[]): boolean {
  if (rows.length !== 5) return false;
  const defaultIds = DEFAULT_TIER_CONFIG.rows.map((r) => r.id);
  return rows.every((r, i) => r.id === defaultIds[i] && r.order === i);
}
