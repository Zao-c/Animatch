import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
describe("public-run identity safety across entry points",()=>{
  const source=readFileSync("src/lib/anisong/shared/templates.ts","utf8");
  it("never lets a range-selection request reuse a changed public song identity",()=>{
    expect(source).toContain("const changedIdentity = doc.tracks.some");
    expect(source).toContain('if (changedIdentity) throw new AppError(');
  });
});
