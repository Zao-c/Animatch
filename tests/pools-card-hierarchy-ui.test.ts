import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pool listing card hierarchy", () => {
  const source = readFileSync("src/app/pools/page.tsx", "utf8");
  const card = source.slice(source.indexOf("function PoolCard("), source.indexOf("function CoverStrip("));

  it("keeps match and detail actions available while reducing competing solid buttons", () => {
    expect(card).toContain("canMatch || canPromptLoginToMatch ? (");
    expect(card).toContain('variant={hasOngoingMatch ? "primary" : "ghost"}');
    expect(card).toContain('onOpenRun(pool, "match")');
    expect(card).toContain('href={`/pools/${pool.id}`}');
    expect(card).toContain("canPromptLoginToMatch");
    expect(card).toContain('aria-label={`查看${pool.name}详情`}');
  });

  it("retains archive, restore, editing, and tier access behind a quiet disclosure", () => {
    const more = card.slice(card.indexOf('<details className="mt-3 border-t'), card.indexOf("</details>"));
    expect(more).toContain("更多操作");
    expect(more).toContain("番组设置");
    expect(more).toContain("恢复番组");
    expect(more).toContain("归档番组");
    expect(more).toContain("查看 Tier");
    expect(more).toContain("添加动画");
    expect(more).not.toContain('size="sm"');
    expect(more).toContain('min-h-11');
  });

  it("presents count metadata as quiet text rather than repeated pills", () => {
    expect(card).toContain("<span>{animeCount} 部动画</span>");
    expect(card).toContain("<span>{comparisonLabel}</span>");
    expect(card).toContain('tone={toneForStatus(uiStatus)}');
    expect(card).toContain("pool.description?.trim()");
    expect(card).not.toContain('pool.description ?? "暂无描述"');
  });
});
