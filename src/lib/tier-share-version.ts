import { createHash } from "node:crypto";
import type { RunTierListResult } from "./tier-service";

type ShareableTierState = Pick<RunTierListResult,
  "tiers" | "tierRows" | "totalAnime" | "comparedAnime" | "totalComparisons" | "effectiveComparisons"
>;

/** Sharing checks the displayed ranking as well as manual edits, including other-tab votes. */
export function createTierShareVersion(state: ShareableTierState): string {
  return createHash("sha256").update(JSON.stringify({
    rows: state.tierRows,
    tiers: state.tierRows.map((row) => [row.id, state.tiers[row.id] ?? []]),
    totalAnime: state.totalAnime,
    comparedAnime: state.comparedAnime,
    totalComparisons: state.totalComparisons,
    effectiveComparisons: state.effectiveComparisons
  })).digest("hex");
}
