import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pool listing card hierarchy", () => {
  const source = readFileSync("src/app/pools/page.tsx", "utf8");
  const card = source.slice(source.indexOf("function PoolCard("), source.indexOf("function CoverStrip("));

  it("uses one consistent primary duel action and retains a quiet details link", () => {
    expect(card).toContain("canMatch || canPromptLoginToMatch ? (");
    expect(card).toContain('variant="primary"');
    expect(card).not.toContain('variant={hasOngoingMatch ? "primary" : "ghost"}');
    expect(card).toContain('onOpenRun(pool, "match")');
    expect(card).toContain('href={`/pools/${pool.id}`}');
    expect(card).toContain("canPromptLoginToMatch");
    expect(card).toContain('aria-label={`查看${pool.name}详情`}');
    expect(card).toContain('hasOngoingMatch');
    expect(card).toContain('"继续对决"');
    expect(card).toContain('"登录后对决"');
    expect(card).toContain('"个人自由对决"');
  });

  it("does not repeat public view context and keeps community count readable", () => {
    expect(card).toContain("!officialDemoLabel && !isPublicView");
    expect(card).not.toContain('<AppBadge tone="status">开放参与</AppBadge>');
    expect(card).toContain('className="mt-0.5 text-xs text-slate-400"');
  });

  it("exposes Tier viewing next to duel and detail instead of burying it under more actions", () => {
    const actionStart = card.indexOf('<div className="mt-auto grid');
    const moreStart = card.indexOf('<details className="mt-3 border-t');
    const actionRow = card.slice(actionStart, moreStart);
    const more = card.slice(moreStart, card.indexOf("</details>", moreStart));

    expect(actionRow).toContain('onOpenRun(pool, "match")');
    expect(actionRow).toContain('onOpenRun(pool, "tier")');
    expect(actionRow).toContain('tierEntry.kind === "create"');
    expect(actionRow).toContain('tierEntry.kind !== "none"');
    expect(actionRow).toContain("详情");
    expect(actionRow).toContain("tierEntry.href");
    expect(more).not.toContain("查看 Tier");
    expect(more).not.toContain('onOpenRun(pool, "tier")');
  });

  it("keeps only management actions in the accessible, expandable section", () => {
    const moreStart = card.indexOf('<details className="mt-3 border-t');
    const more = card.slice(moreStart, card.indexOf("</details>", moreStart));
    expect(more).toContain("更多操作");
    expect(more).toContain('aria-label={`${pool.name}的更多操作`}');
    expect(more).toContain("番组设置");
    expect(more).toContain("恢复番组");
    expect(more).toContain("归档番组");
    expect(more).not.toContain("添加动画");
    expect(more).toContain('min-h-11');
  });

  it("shows the add-anime shortcut outside the collapsed controls only for editors", () => {
    const shortcutIndex = card.indexOf('aria-label={`向${pool.name}添加动画`}');
    const moreIndex = card.indexOf('<details className="mt-3 border-t');
    expect(shortcutIndex).toBeGreaterThan(0);
    expect(shortcutIndex).toBeLessThan(moreIndex);
    expect(card).toContain('!isArchived && canAddAnime && (!isPublicView || canManage) ? (');
    expect(card).toContain('href={`/pools/${pool.id}#add-anime`}');
    expect(card).toContain('size: "md"');
  });

  it("presents count metadata as quiet text rather than repeated pills", () => {
    expect(card).toContain("<span>{animeCount} 部动画</span>");
    expect(card).toContain("<span>{comparisonLabel}</span>");
    expect(card).toContain('tone={toneForStatus(uiStatus)}');
    expect(card).toContain("pool.description?.trim()");
    expect(card).not.toContain('pool.description ?? "暂无描述"');
  });
});
