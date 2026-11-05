import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong publisher deletion and licensing guardrails", () => {
  const service = readFileSync("src/lib/anisong/service.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const publisher = readFileSync("src/components/anisong/SongTemplatePublisher.tsx", "utf8");
  const updateRoute = readFileSync("src/app/api/anisong/boards/[boardId]/template-update/route.ts", "utf8");

  it("keeps the original template record to retain participant identity and permissions", () => {
    expect(service).toContain("transaction.songTemplate.updateMany");
    expect(service).toContain("data: { active: false }");
    expect(service).not.toContain("transaction.songTemplate.deleteMany");
    expect(schema).toMatch(/template\s+SongTemplate\?\s+@relation\("SongTemplateRuns",\s*fields:\s*\[templateId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/);
    expect(schema).toMatch(/sourceBoard\s+SongBoard\?\s+@relation\("SongTemplateSource",\s*fields:\s*\[sourceBoardId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/);
    expect(updateRoute).toContain("if(!template) return ok({unavailable:true");
  });

  it("asks for fresh authorization when the set of songs changes", () => {
    expect(publisher).toContain("}, [board.id, board.revision]);");
    expect(publisher).toContain("setConfirmed(false)");
    expect(publisher).toContain('checked={confirmed}');
    expect(publisher).toContain("disabled={disabled || publishing || checking || Boolean(checkError) || !confirmed || count < 2}");
    expect(publisher).toContain("shareAudioConfirmed");
  });

  it("does not misrepresent an unreadable public version as unpublished", () => {
    expect(publisher).toContain("const [checking, setChecking]");
    expect(publisher).toContain("const controller = new AbortController()");
    expect(publisher).toContain("if (!controller.signal.aborted) setCheckError");
    expect(publisher).toContain("读取公开版本失败");
    expect(publisher).toContain("重新检查");
    expect(publisher).not.toContain(".catch(() => {})");
  });
});
