import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { NextRequest } from "next/server";
import { PATCH as adminPoolPatch } from "../src/app/api/admin/pools/[poolId]/route";
import { updateAdminPool } from "../src/lib/client-api";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/admin-auth", () => ({
  requireSiteAdmin: vi.fn(async () => ({ id: "admin-1", username: "admin" })),
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const HEADERS = { "Content-Type": "application/json" };

function poolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    name: "Pool",
    description: "旧描述",
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    deletedAt: null,
    isOfficialDemo: false,
    allowPublicEdit: false,
    allowCommunityMatch: false,
    tags: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    creator: { id: "user-1", name: "U", username: "u", image: null },
    _count: { poolAnime: 0 },
    ...overrides,
  };
}

function captureFetch() {
  const captured: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      captured.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data: poolRow() }), {
        status: 200,
        headers: HEADERS,
      });
    })
  );
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCustomPool.findUnique.mockResolvedValue(poolRow() as never);
  mockedCustomPool.update.mockResolvedValue(poolRow({ description: null }) as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The admin edit form used to pass `description: editDescription || undefined`,
 * which dropped the key from the JSON body for an empty string, so clearing a
 * pool description silently did nothing. These tests exercise the real client
 * helper and replay its exact request into the real admin PATCH route.
 */
describe("admin pool edit client/server contract", () => {
  it("sends an empty description and the route clears it to null", async () => {
    const captured = captureFetch();

    await updateAdminPool("pool-1", {
      name: "Pool",
      description: "",
      visibility: "PRIVATE",
    });

    expect(captured).toHaveLength(1);
    const { url, init } = captured[0];
    expect(url).toBe("/api/admin/pools/pool-1");
    expect(init.method).toBe("PATCH");

    const decoded = JSON.parse(init.body as string);
    expect(decoded).toHaveProperty("description", "");

    const request = new NextRequest(`http://test.local${url}`, {
      method: "PATCH",
      headers: HEADERS,
      body: init.body as string,
    });
    const response = await adminPoolPatch(request, { params: { poolId: "pool-1" } });

    expect(response.status).toBe(200);
    expect(mockedCustomPool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null }),
      })
    );
  });

  it("omits the description entirely when the caller does not provide one", async () => {
    const captured = captureFetch();

    await updateAdminPool("pool-1", { name: "Pool" });

    const decoded = JSON.parse(captured[0].init.body as string);
    expect(decoded).not.toHaveProperty("description");
  });
});
