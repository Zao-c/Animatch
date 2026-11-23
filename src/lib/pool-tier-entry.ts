type PoolTierEntryInput = {
  poolId: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  defaultRunId: string | null | undefined;
  isArchived: boolean;
  canPlay: boolean;
};

export type PoolTierEntry =
  | { kind: "personal"; href: string; label: "查看 Tier" }
  | { kind: "community"; href: string; label: "社区榜" }
  | { kind: "create"; label: "创建 Tier" }
  | { kind: "login"; href: string; label: "登录建榜" }
  | { kind: "none" };

export function resolvePoolTierEntry(pool: PoolTierEntryInput): PoolTierEntry {
  // Archived pools are not readable via the personal Tier or community ranking APIs.
  if (pool.isArchived) return { kind: "none" };

  if (pool.defaultRunId) {
    return {
      kind: "personal",
      href: `/pools/${pool.poolId}/runs/${pool.defaultRunId}/tier`,
      label: "查看 Tier"
    };
  }

  if (pool.visibility === "PUBLIC") {
    return {
      kind: "community",
      href: `/pools/${pool.poolId}#community-ranking`,
      label: "社区榜"
    };
  }

  if (pool.canPlay) return { kind: "create", label: "创建 Tier" };

  return {
    kind: "login",
    href: `/login?next=${encodeURIComponent(`/pools/${pool.poolId}`)}`,
    label: "登录建榜"
  };
}
