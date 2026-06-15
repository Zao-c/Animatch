import { PoolStatus, Visibility, type CustomPool } from "@prisma/client";
import type { FriendAuthUser } from "./auth-session";

type PoolPermissionFields = Pick<
  CustomPool,
  "creatorId" | "visibility" | "allowCommunityMatch"
>;
type CommunityRankingPoolFields = Pick<
  CustomPool,
  "visibility" | "status" | "deletedAt"
>;

type MaybeUser = Pick<FriendAuthUser, "id"> | null | undefined;

export function canReadPool(pool: PoolPermissionFields, user?: MaybeUser): boolean {
  if (isPoolOwner(pool, user)) {
    return true;
  }

  return pool.visibility === Visibility.PUBLIC || pool.visibility === Visibility.UNLISTED;
}

export function canPlayPool(pool: PoolPermissionFields, user?: MaybeUser): boolean {
  if (user === null || user === undefined) {
    return false;
  }

  if (isPoolOwner(pool, user)) {
    return true;
  }

  return pool.visibility === Visibility.PUBLIC || pool.visibility === Visibility.UNLISTED;
}

export function canManagePool(pool: PoolPermissionFields, user?: MaybeUser): boolean {
  return isPoolOwner(pool, user);
}

export function canAddAnime(pool: PoolPermissionFields, user?: MaybeUser): boolean {
  return isPoolOwner(pool, user);
}

export function canReadCommunityRanking(pool: CommunityRankingPoolFields): boolean {
  return (
    pool.visibility === Visibility.PUBLIC &&
    pool.status !== PoolStatus.ARCHIVED &&
    pool.deletedAt === null
  );
}

export function getPoolPermissions(pool: PoolPermissionFields, user?: MaybeUser) {
  return {
    canRead: canReadPool(pool, user),
    canPlay: canPlayPool(pool, user),
    canManage: canManagePool(pool, user),
    canAddAnime: canAddAnime(pool, user),
    canCommunityMatch: pool.allowCommunityMatch && canReadPool(pool, user)
  };
}

function isPoolOwner(pool: Pick<CustomPool, "creatorId">, user?: MaybeUser): boolean {
  return user !== null && user !== undefined && pool.creatorId === user.id;
}
