import { PoolStatus, Visibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, DELETE } from "../src/app/api/admin/session/route";
import { GET as GET_ADMIN_POOLS } from "../src/app/api/admin/pools/route";
import { PATCH as PATCH_ADMIN_POOL } from "../src/app/api/admin/pools/[poolId]/route";
import { AppError } from "../src/lib/app-error";
import { getCurrentUser, requireCurrentUser } from "../src/lib/auth-session";
import { prisma } from "../src/lib/db";
import * as adminAuthMod from "../src/lib/admin-auth";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(),
  getCurrentUser: vi.fn()
}));

vi.mock("../src/lib/admin-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/admin-auth")>();
  return {
    ...actual,
    requireSiteAdmin: vi.fn(),
    isSiteAdminUser: vi.fn(),
    verifyAdminCode: vi.fn(),
    createAdminSessionCookie: vi.fn(),
    clearAdminSessionCookie: vi.fn(),
    getAdminSession: vi.fn(),
    isAdminEditSession: vi.fn()
  };
});

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn()
    }
  }
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined)
  }))
}));

const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);
const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedRequireSiteAdmin = vi.mocked(adminAuthMod.requireSiteAdmin);
const mockedIsSiteAdminUser = vi.mocked(adminAuthMod.isSiteAdminUser);
const mockedVerifyAdminCode = vi.mocked(adminAuthMod.verifyAdminCode);
const mockedCreateAdminSessionCookie = vi.mocked(adminAuthMod.createAdminSessionCookie);
const mockedClearAdminSessionCookie = vi.mocked(adminAuthMod.clearAdminSessionCookie);
const mockedIsAdminEditSession = vi.mocked(adminAuthMod.isAdminEditSession);

const ADMIN_USER = {
  id: "admin-user-id-001",
  username: "admin",
  name: "Admin",
  image: null
};

const REGULAR_USER = {
  id: "regular-user-id-002",
  username: "user",
  name: "User",
  image: null
};

function makePool(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id as string ?? "pool-1",
    creatorId: (overrides.creatorId as string) ?? "owner-1",
    name: (overrides.name as string) ?? "Test Pool",
    description: null,
    coverUrl: null,
    visibility: (overrides.visibility as Visibility) ?? Visibility.PUBLIC,
    status: (overrides.status as PoolStatus) ?? PoolStatus.PUBLISHED,
    allowPublicEdit: false,
    allowCommunityMatch: false,
    isOfficialDemo: false,
    tags: [],
    affectsGlobalTaste: false,
    deletedAt: (overrides.deletedAt as Date | null) ?? null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-06-01"),
    _count: { poolAnime: (overrides.animeCount as number) ?? 5 },
    creator: {
      id: "owner-1",
      name: "Owner",
      username: "owner",
      image: null
    }
  };
}

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

function setAdminOk() {
  mockedRequireSiteAdmin.mockResolvedValue(ADMIN_USER);
}

describe("Admin Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated access to admin session", async () => {
    mockedRequireCurrentUser.mockRejectedValue(
      new AppError("Authentication required", 401, "AUTH_REQUIRED")
    );

    const req = new Request("http://localhost/api/admin/session", {
      method: "POST",
      body: JSON.stringify({ code: "test" })
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("rejects access for regular user", async () => {
    mockedRequireCurrentUser.mockResolvedValue(REGULAR_USER);
    mockedIsSiteAdminUser.mockReturnValue(false);

    const req = new Request("http://localhost/api/admin/session", {
      method: "POST",
      body: JSON.stringify({ code: "test" })
    });
    const response = await POST(req);
    expect(response.status).toBe(403);
  });
});

describe("Admin Pools API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin can list pools with visibility, status, deleted filters", async () => {
    setAdminOk();

    mockedCustomPool.findMany.mockResolvedValue([
      makePool({ id: "pool-1", name: "Public Pool", visibility: Visibility.PUBLIC }),
      makePool({ id: "pool-2", name: "Private Pool", visibility: Visibility.PRIVATE })
    ] as any);
    mockedCustomPool.count.mockResolvedValue(2);

    const req = new Request("http://localhost/api/admin/pools?visibility=PUBLIC");
    const response = await GET_ADMIN_POOLS(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(2);
    expect(payload.data.total).toBe(2);
  });

  it("admin can list deleted pools", async () => {
    setAdminOk();

    mockedCustomPool.findMany.mockResolvedValue([
      makePool({ id: "pool-1", name: "Pool 1", deletedAt: new Date() })
    ] as any);
    mockedCustomPool.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/admin/pools?deleted=deleted");
    const response = await GET_ADMIN_POOLS(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(1);
  });

  it("admin can filter by demo pools", async () => {
    setAdminOk();

    const demoPool = {
      ...makePool({ id: "pool-1", name: "Demo", isOfficialDemo: true }),
      isOfficialDemo: true
    };
    mockedCustomPool.findMany.mockResolvedValue([demoPool] as any);
    mockedCustomPool.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/admin/pools?demo=true");
    const response = await GET_ADMIN_POOLS(req);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(1);
    const item = payload.data.items[0];
    expect(item.name).toBe("Demo");
  });

  it("non-admin cannot access admin pools list", async () => {
    mockedRequireSiteAdmin.mockRejectedValue(
      new AppError("You are not authorized to access the admin console", 403, "ADMIN_FORBIDDEN")
    );

    const req = new Request("http://localhost/api/admin/pools");
    const response = await GET_ADMIN_POOLS(req);
    expect(response.status).toBe(403);
  });

  it("admin can update pool name and description", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1", name: "Old Name", description: "Old Desc" });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);
    mockedCustomPool.update.mockResolvedValue({
      ...pool,
      name: "New Name",
      description: "New Desc",
      _count: { poolAnime: 5 },
      creator: { id: "owner-1", name: "Owner", username: "owner", image: null }
    } as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name", description: "New Desc" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("New Name");
    expect(payload.data.description).toBe("New Desc");
  });

  it("admin can archive a pool with confirm", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1", status: PoolStatus.PUBLISHED });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);
    mockedCustomPool.update.mockResolvedValue({
      ...pool,
      status: PoolStatus.ARCHIVED,
      _count: { poolAnime: 5 },
      creator: { id: "owner-1", name: "Owner", username: "owner", image: null }
    } as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ archive: true, confirm: "CONFIRM" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe(PoolStatus.ARCHIVED);
  });

  it("admin cannot archive without confirm", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1", status: PoolStatus.PUBLISHED });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ archive: true })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    expect(response.status).toBe(400);
  });

  it("rejects requests that combine multiple dangerous operations", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1", status: PoolStatus.PUBLISHED });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ archive: true, softDelete: true, confirm: "CONFIRM" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toContain("Only one dangerous operation");
    expect(mockedCustomPool.update).not.toHaveBeenCalled();
  });

  it("admin can soft delete a pool with confirm", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1" });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);
    mockedCustomPool.update.mockResolvedValue({
      ...pool,
      deletedAt: new Date(),
      status: PoolStatus.ARCHIVED,
      _count: { poolAnime: 5 },
      creator: { id: "owner-1", name: "Owner", username: "owner", image: null }
    } as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ softDelete: true, confirm: "CONFIRM" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.deletedAt).not.toBeNull();
  });

  it("admin can restore deleted pool with confirm", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1", deletedAt: new Date(), status: PoolStatus.ARCHIVED });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);
    mockedCustomPool.update.mockResolvedValue({
      ...pool,
      deletedAt: null,
      _count: { poolAnime: 5 },
      creator: { id: "owner-1", name: "Owner", username: "owner", image: null }
    } as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ restoreDeleted: true, confirm: "CONFIRM" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.deletedAt).toBeNull();
  });

  it("admin can restore archived pool with confirm", async () => {
    setAdminOk();

    const pool = makePool({ id: "pool-1", status: PoolStatus.ARCHIVED });
    mockedCustomPool.findUnique.mockResolvedValue(pool as any);
    mockedCustomPool.update.mockResolvedValue({
      ...pool,
      status: PoolStatus.DRAFT,
      _count: { poolAnime: 5 },
      creator: { id: "owner-1", name: "Owner", username: "owner", image: null }
    } as any);

    const req = new Request("http://localhost/api/admin/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ restoreArchived: true, confirm: "CONFIRM" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "pool-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe(PoolStatus.DRAFT);
  });

  it("pool not found returns 404", async () => {
    setAdminOk();

    mockedCustomPool.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/pools/nonexistent", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" })
    });
    const response = await PATCH_ADMIN_POOL(req, { params: { poolId: "nonexistent" } });
    expect(response.status).toBe(404);
  });
});

describe("Admin Content Permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin can edit any non-archived pool content via canEditPoolContent", async () => {
    const { canEditPoolContent } = await import("../src/lib/pool-permissions");

    const pool = {
      creatorId: "owner-1",
      visibility: Visibility.PRIVATE,
      status: PoolStatus.PUBLISHED,
      deletedAt: null,
      isOfficialDemo: false,
      allowPublicEdit: false
    };

    const nonOwner = { id: "admin-1", username: "admin", name: "Admin", image: null };

    expect(canEditPoolContent(pool, nonOwner)).toBe(false);
    expect(canEditPoolContent(pool, nonOwner, { isAdmin: true })).toBe(true);
  });

  it("admin cannot edit archived pool content", async () => {
    const { canEditPoolContent } = await import("../src/lib/pool-permissions");

    const archivedPool = {
      creatorId: "owner-1",
      visibility: Visibility.PUBLIC,
      status: PoolStatus.ARCHIVED,
      deletedAt: null,
      isOfficialDemo: false,
      allowPublicEdit: false
    };

    const adminUser = { id: "admin-1", username: "admin", name: "Admin", image: null };

    expect(canEditPoolContent(archivedPool, adminUser, { isAdmin: true })).toBe(false);
  });

  it("admin cannot edit soft-deleted pool content", async () => {
    const { canEditPoolContent } = await import("../src/lib/pool-permissions");

    const deletedPool = {
      creatorId: "owner-1",
      visibility: Visibility.PUBLIC,
      status: PoolStatus.PUBLISHED,
      deletedAt: new Date(),
      isOfficialDemo: false,
      allowPublicEdit: false
    };

    const adminUser = { id: "admin-1", username: "admin", name: "Admin", image: null };

    expect(canEditPoolContent(deletedPool, adminUser, { isAdmin: true })).toBe(false);
  });

  it("regular non-owner still cannot edit private pool", async () => {
    const { canEditPoolContent } = await import("../src/lib/pool-permissions");

    const privatePool = {
      creatorId: "owner-1",
      visibility: Visibility.PRIVATE,
      status: PoolStatus.PUBLISHED,
      deletedAt: null,
      isOfficialDemo: false,
      allowPublicEdit: false
    };

    const nonOwner = { id: "user-2", username: "user2", name: "User2", image: null };

    expect(canEditPoolContent(privatePool, nonOwner)).toBe(false);
  });

  it("owner permission is not regressed", async () => {
    const { canEditPoolContent } = await import("../src/lib/pool-permissions");

    const pool = {
      creatorId: "owner-1",
      visibility: Visibility.PRIVATE,
      status: PoolStatus.PUBLISHED,
      deletedAt: null,
      isOfficialDemo: false,
      allowPublicEdit: false
    };

    const owner = { id: "owner-1", username: "owner", name: "Owner", image: null };

    expect(canEditPoolContent(pool, owner)).toBe(true);
  });

  it("demo pool collaborative editing is not regressed", async () => {
    const { canEditPoolContent } = await import("../src/lib/pool-permissions");

    const demoPool = {
      creatorId: "demo-owner",
      visibility: Visibility.PUBLIC,
      status: PoolStatus.PUBLISHED,
      deletedAt: null,
      isOfficialDemo: true,
      allowPublicEdit: true
    };

    const loggedInUser = { id: "user-99", username: "user", name: "User", image: null };

    expect(canEditPoolContent(demoPool, loggedInUser)).toBe(true);
  });
});
