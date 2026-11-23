import type { QuickImportParams } from "./quick-pool-builder";

export const QUICK_IMPORT_PRESETS: { label: string; params: QuickImportParams }[] = [
  {
    label: "2026 TV 新番 Top 50",
    params: { source: "MIXED", mode: "YEAR", year: 2026, type: "TV", limit: 50, sort: "rank" },
  },
  {
    label: "2025 TV 新番 Top 50",
    params: { source: "MIXED", mode: "YEAR", year: 2025, type: "TV", limit: 50, sort: "rank" },
  },
  {
    label: "恋爱校园 Top 30",
    params: { source: "MIXED", mode: "TAG", tags: ["romance", "school"], type: "TV", limit: 30, sort: "rank" },
  },
  {
    label: "异世界 Top 30",
    params: { source: "MIXED", mode: "TAG", tags: ["isekai"], type: "TV", limit: 30, sort: "rank" },
  },
  {
    label: "热血战斗 Top 50",
    params: { source: "MIXED", mode: "TAG", tags: ["action", "hot blooded"], type: "TV", limit: 50, sort: "rank" },
  },
  {
    label: "Bangumi Top 100 TV",
    params: { source: "BANGUMI", mode: "TOP", type: "TV", limit: 100, sort: "rank" },
  },
];
