type CommunityBattlePoolVisibility = {
  visibility: string;
  status?: string | null;
  deletedAt?: string | Date | null;
};

export function isCommunityBattleVisiblePool(pool: CommunityBattlePoolVisibility) {
  return pool.visibility === "PUBLIC" && pool.deletedAt == null && pool.status !== "ARCHIVED";
}
