import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public AniSong playlist detail navigation and recovery", () => {
  const page = readFileSync("src/app/anisong/templates/[templateId]/page.tsx", "utf8");
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");

  it("remounts playlist state when navigating to another template", () => {
    expect(page).toContain("key={params.templateId}");
  });
  it("offers an abortable retry on a failed detail request", () => {
    expect(detail).toContain("setRetryKey(value => value + 1)");
    expect(detail).toContain("}, [templateId, retryKey])");
    expect(detail).toContain("return () => controller.abort()");
    expect(detail).toContain("重试加载");
  });
});
