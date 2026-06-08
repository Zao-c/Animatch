import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app-error";
import { validateRunAccessParams } from "../src/lib/run-service";

describe("run-service validation", () => {
  it("accepts complete access parameters", () => {
    expect(() =>
      validateRunAccessParams({
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).not.toThrow();
  });

  it("throws identifiable AppError for missing fields", () => {
    expect(() =>
      validateRunAccessParams({
        userId: "",
        poolId: "pool-1",
        runId: "run-1"
      })
    ).toThrow(AppError);
  });
});
