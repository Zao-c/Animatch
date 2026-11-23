import { describe, expect, it } from "vitest";
import { withTransactionRetry } from "../src/lib/transaction-retry";

describe("serializable transaction retries", () => {
  it("retries Prisma's serializable conflict", async () => {
    let calls = 0;
    expect(await withTransactionRetry(async () => {
      if (++calls === 1) throw { code: "P2034" };
      return "committed";
    })).toBe("committed");
    expect(calls).toBe(2);
  });
  it("retries PostgreSQL 40001 wrapped by Prisma raw query", async () => {
    let calls = 0;
    expect(await withTransactionRetry(async () => {
      if (++calls === 1) throw { code: "P2010", meta: { code: "40001" } };
      return "committed";
    })).toBe("committed");
    expect(calls).toBe(2);
  });
  it("does not retry other database failures", async () => {
    let calls = 0;
    await expect(withTransactionRetry(async () => { calls++; throw { code: "P2010", meta: { code: "42P01" } }; })).rejects.toMatchObject({ code: "P2010" });
    expect(calls).toBe(1);
  });
});
