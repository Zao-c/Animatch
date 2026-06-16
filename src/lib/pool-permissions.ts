import { PoolStatus, Visibility, type CustomPool } from "@prisma/client";
import type { FriendAuthUser } from "./auth-session";

type PoolPermissionFields = Pick<
  CustomPool,
  "creatorId" | "visibility" | "allowCommunityMatch" | "status" | "deletedAt" | "isOfficialDemo" | "allowPublicEdit"
>;
type CommunityRankingPoolFields = Pick<
  CustomPool,
  "visibility" | "status" | "deletedAt"
>;
type EditPermissionFields = Pick<
  CustomPool,
  "creatorId" | "visibility" | "status" | "deletedAt" | "isOfficialDemo" | "allowPublicEdit"
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

export function canEditPoolContent(
  pool: EditPermissionFields,
  user?: MaybeUser,
  opts?: { isAdmin?: boolean }
): boolean {
  if (user === null || user === undefined) {
    return false;
  }

  if (pool.status === PoolStatus.ARCHIVED || pool.deletedAt !== null) {
    return false;
  }

  if (opts?.isAdmin === true) {
    return true;
  }

  if (isPoolOwner(pool, user)) {
    return true;
  }

  if (pool.visibility !== Visibility.PUBLIC) {
    return false;
  }

  if (pool.isOfficialDemo) {
    return true;
  }

  if (pool.allowPublicEdit) {
    return true;
  }

  return false;
}

export function canAddAnime(
  pool: EditPermissionFields,
  user?: MaybeUser,
  opts?: { isAdmin?: boolean }
): boolean {
  return canEditPoolContent(pool, user, opts);
}

export function canReadCommunityRanking(pool: CommunityRankingPoolFields): boolean {
  return (
    pool.visibility === Visibility.PUBLIC &&
    pool.status !== PoolStatus.ARCHIVED &&
    pool.deletedAt === null
  );
}

export function getPoolPermissions(
  pool: PoolPermissionFields,
  user?: MaybeUser,
  opts?: { isAdmin?: boolean }
) {
  return {
    canRead: canReadPool(pool, user),
    canPlay: canPlayPool(pool, user),
    canManage: canManagePool(pool, user),
    canAddAnime: canAddAnime(pool, user, opts),
    canCommunityMatch: pool.allowCommunityMatch && canReadPool(pool, user),
    isAdmin: opts?.isAdmin ?? false
  };
}

function isPoolOwner(pool: Pick<CustomPool, "creatorId">, user?: MaybeUser): boolean {
  return user !== null && user !== undefined && pool.creatorId === user.id;
}
