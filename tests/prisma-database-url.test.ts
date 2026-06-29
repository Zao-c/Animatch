import { afterEach, describe, expect, it } from "vitest";
import { buildPrismaDatabaseUrl } from "../src/lib/prisma-database-url";

const originalConnectionLimit = process.env.PRISMA_CONNECTION_LIMIT;
const originalPoolTimeout = process.env.PRISMA_POOL_TIMEOUT;

afterEach(() => {
  restoreEnv("PRISMA_CONNECTION_LIMIT", originalConnectionLimit);
  restoreEnv("PRISMA_POOL_TIMEOUT", originalPoolTimeout);
});

describe("buildPrismaDatabaseUrl", () => {
  it("adds production-safe pool defaults when DATABASE_URL has no query", () => {
    const url = buildPrismaDatabaseUrl("postgresql://user:pass@postgres:5432/animatch");

    expect(url).toBe("postgresql://user:pass@postgres:5432/animatch?connection_limit=20&pool_timeout=10");
  });

  it("preserves existing query params and explicit pool settings", () => {
    const url = buildPrismaDatabaseUrl(
      "postgresql://user:pass@postgres:5432/animatch?schema=public&connection_limit=20"
    );

    expect(url).toBe(
      "postgresql://user:pass@postgres:5432/animatch?schema=public&connection_limit=20&pool_timeout=10"
    );
  });

  it("allows env overrides for pool defaults", () => {
    process.env.PRISMA_CONNECTION_LIMIT = "12";
    process.env.PRISMA_POOL_TIMEOUT = "4";

    const url = buildPrismaDatabaseUrl("postgresql://user:pass@postgres:5432/animatch");

    expect(url).toBe("postgresql://user:pass@postgres:5432/animatch?connection_limit=12&pool_timeout=4");
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
