import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw
  }
}));

import { GET } from "@/app/api/health/route";

describe("health API", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("returns healthy only after the database probe succeeds", async () => {
    mocks.queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "animematch",
      database: "ready"
    });
  });

  it("returns an unhealthy status when the database cannot be reached", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      service: "animematch",
      database: "unavailable"
    });
  });
});

describe("production health configuration", () => {
  const composeSource = readFileSync("docker-compose.prod.yml", "utf8");

  it("probes the app health endpoint from the application container", () => {
    expect(composeSource).toContain("healthcheck:");
    expect(composeSource).toContain("http://127.0.0.1:3000/api/health");
    expect(composeSource).toContain("start_period: 30s");
  });
});
