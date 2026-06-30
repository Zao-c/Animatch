import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season detail UI", () => {
  const source = readFileSync(
    "src/app/pools/[poolId]/seasons/[seasonId]/page.tsx",
    "utf8"
  );

  it("uses a wider desktop canvas for shared rankings", () => {
    expect(source).toContain("max-w-6xl");
    expect(source).not.toContain("mx-auto max-w-4xl px-4 py-8");
  });

  it("keeps shared tier rows visually light", () => {
    expect(source).toContain("grid-cols-[56px_1fr]");
    expect(source).toContain("bg-white/[0.035]");
    expect(source).toContain("rounded-xl text-base font-extrabold");
  });

  it("renders larger tier cards for readable covers", () => {
    expect(source).toContain("w-28 rounded-xl");
    expect(source).toContain("sm:w-32");
    expect(source).toContain("h-32 w-full rounded-lg sm:h-36");
  });
});
