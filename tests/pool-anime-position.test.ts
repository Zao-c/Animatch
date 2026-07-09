import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pool anime position allocation", () => {
  const helperSource = readFileSync("src/lib/pool-anime-position.ts", "utf8");

  it("allocates pool anime positions inside a Serializable transaction", () => {
    expect(helperSource).toContain("withPoolAnimePositionTransaction");
    expect(helperSource).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(helperSource).toContain("tx.poolAnime.aggregate");
    expect(helperSource).toContain("return (maxPosition._max.position ?? 0) + 1");
  });

  it("retries Prisma serializable write conflicts", () => {
    expect(helperSource).toContain("SERIALIZABLE_RETRY_ATTEMPTS = 3");
    expect(helperSource).toContain("error.code === \"P2034\"");
  });

  it("uses the shared allocator across pool add/import entry points", () => {
    const files = [
      "src/app/api/pools/[poolId]/anime/route.ts",
      "src/app/api/pools/[poolId]/anime/bulk-import/route.ts",
      "src/app/api/pools/[poolId]/custom-items/route.ts",
      "src/lib/import/quick-pool-builder.ts",
      "src/lib/tiermaker-import.ts"
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("withPoolAnimePositionTransaction");
      expect(source).toContain("getNextPoolAnimePosition");
    }
  });
});
