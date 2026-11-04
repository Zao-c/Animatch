import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
describe("public song version update UI",()=>{it("requires explicit update and shows version diffs",()=>{const s=readFileSync("src/components/anisong/SongVersionUpdateNotice.tsx","utf8");expect(s).toContain("公开曲单有新版本");expect(s).toContain("includeNew");expect(s).toContain("历史记录不删除");});});
