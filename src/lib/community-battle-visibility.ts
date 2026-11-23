type CommunityBattlePoolVisibility = {
  visibility: string;
  allowCommunityMatch?: boolean | null;
  status?: string | null;
  deletedAt?: string | Date | null;
};

export function isCommunityBattleVisiblePool(pool: CommunityBattlePoolVisibility) {
  return pool.visibility === "PUBLIC" && pool.allowCommunityMatch === true &&
    pool.deletedAt == null && pool.status !== "ARCHIVED";
}
