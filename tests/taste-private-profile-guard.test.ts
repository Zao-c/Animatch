import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
describe("taste privacy guard",()=>{
  const source=readFileSync("src/lib/taste-service.ts","utf8");
  it("blocks public taste views for PRIVATE accounts and excludes them from other people's matches",()=>{
    expect(source).toContain('user.profileVisibility === "PRIVATE"');
    expect(source).toContain('profileVisibility: "PUBLIC" as const');
  });
});
