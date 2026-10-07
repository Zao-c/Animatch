import { normalizeTierConfig, type TierRowConfig } from "./tier-config";
import type { PublicTierShare, TierShareSnapshotItem } from "./client-api";

export interface ManualBoardLayout {
  rows: TierRowConfig[];
  tiers: Record<string, string[]>;
}

export interface ManualBoardData {
  pool: { id: string; name: string };
  title: string;
  revision: number;
  layout: ManualBoardLayout;
  items: TierShareSnapshotItem[];
  shareUrl: string | null;
}

export function validateManualBoard(value: unknown, allowedIds: Set<string>): {
  title: string; revision: number; layout: ManualBoardLayout;
} {
  const input = value as Record<string, unknown> | null;
  if (!input || typeof input !== "object" || typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 100) {
    throw new Error("请填写 1–100 字的榜单标题。");
  }
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) throw new Error("草稿版本无效，请刷新后重试。");
  const layout = input.layout as Partial<ManualBoardLayout> | null;
  const config = normalizeTierConfig({ version: 1, rows: layout?.rows });
  if (!config.ok) throw new Error(config.error);
  if (!layout?.tiers || typeof layout.tiers !== "object" || Array.isArray(layout.tiers)) throw new Error("榜单内容无效。");
  const rowIds = new Set(config.config.rows.map((row) => row.id));
  if (Object.keys(layout.tiers).some((id) => !rowIds.has(id))) throw new Error("榜单包含无效档位。");
  const tiers: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const row of config.config.rows) {
    const ids = layout.tiers[row.id];
    if (!Array.isArray(ids)) throw new Error("档位作品列表无效。");
    tiers[row.id] = ids.map((id) => {
      if (typeof id !== "string" || !allowedIds.has(id)) throw new Error("作品已被移出番组，请刷新后重试。");
      if (seen.has(id)) throw new Error("同一作品不能重复分档。");
      seen.add(id);
      return id;
    });
  }
  return { title: input.title.trim(), revision: input.revision as number, layout: { rows: config.config.rows, tiers } };
}

// Undefined target puts an item back in the unranked tray. Only ranked IDs are persisted.
export function moveBoardItem(layout: ManualBoardLayout, animeId: string, target?: string, before?: string): ManualBoardLayout {
  if (before === animeId || (target && !layout.rows.some((row) => row.id === target))) return layout;
  const tiers = Object.fromEntries(layout.rows.map((row) => [row.id, (layout.tiers[row.id] ?? []).filter((id) => id !== animeId)]));
  if (target) {
    const index = before ? tiers[target].indexOf(before) : -1;
    tiers[target].splice(index < 0 ? tiers[target].length : index, 0, animeId);
  }
  return { ...layout, tiers };
}

export function buildManualBoardShare(board: ManualBoardData): PublicTierShare {
  const byId = new Map(board.items.map((item) => [item.animeId, item]));
  const tiers = board.layout.rows.map((row) => ({
    key: row.id, label: row.label, color: row.color,
    items: (board.layout.tiers[row.id] ?? []).flatMap((id) => byId.has(id) ? [byId.get(id)!] : [])
  }));
  return {
    token: "manual-board", title: board.title, description: "自由排榜", createdAt: new Date().toISOString(),
    tierLabels: Object.fromEntries(board.layout.rows.map((row) => [row.id, row.label])),
    snapshot: { version: 1, generatedAt: new Date().toISOString(), pool: board.pool,
      run: { id: "manual-board" }, rankingMode: "manual", tiers, tierRows: board.layout.rows,
      animeCount: tiers.reduce((sum, tier) => sum + tier.items.length, 0), comparisonCount: 0 }
  };
}
