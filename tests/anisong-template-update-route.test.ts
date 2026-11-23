import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
describe("public template update contract", () => {
  const code=readFileSync("src/app/api/anisong/boards/[boardId]/template-update/route.ts","utf8");
  it("requires owner authentication and a specific public revision", () => {
    expect(code).toContain("requireCurrentUser()");
    expect(code).toContain("ownedSongBoard(userId,boardId)");
    expect(code).toContain("load(user.id,params.boardId)");
    expect(code).toContain("template.revision!==target");
    expect(code).toContain("board.revision!==revision");
  });
  it("preserves all old events and writes the new public revision with optimistic concurrency", () => {
    expect(code).toContain("applySongTemplateVersion(");
    expect(code).toContain("templateRevision:latest.revision,revision:{increment:1}");
    expect(code).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(code).toContain("latest.revision!==target");
    expect(code).toContain('cause.code==="P2034"');
    expect(code).toContain("where:{id:board.id,ownerId:user.id,revision}");
  });
});
