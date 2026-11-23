import { readFileSync } from "node:fs";
import { describe,it,expect } from "vitest";
describe("community preview algorithm isolation",()=>{
  const s=readFileSync("src/app/api/anisong/templates/[templateId]/community-ranking/route.ts","utf8");
  it("leaves the legacy ranking unchanged unless explicitly requested",()=>{
    expect(s).toContain('searchParams.get("algorithm") === "bt-preview"');
    expect(s).toContain('if (experimental)');
    expect(s).toContain("communityRatingPreview");
    expect(s).toContain("totalElo / value.participants");
    expect(s).toContain("sampled:runs.length>=250");
  });
});
