import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tier List minimal UI polish", () => {
  const source = readFileSync("src/app/tierlists/page.tsx", "utf8");

  it("keeps personal draft access and draws attention to the most recent draft", () => {
    expect(source).toContain("继续我的榜单");
    expect(source).toContain('drafts.map((draft, index)');
    expect(source).toContain('index === 0');
    expect(source).toContain('aria-label={`继续编辑${draft.title}`}');
    expect(source).toContain('href={`/pools/${draft.poolId}/tier-maker`}');
    expect(source).toContain('draft.shareToken ? "已分享" : "私人草稿"');
  });

  it("keeps full cards clickable without repeating a visual CTA in every card", () => {
    expect(source).toContain('href={`/pools/${pool.id}/tier-maker`}');
    expect(source).toContain('aria-label={`为${pool.name}制作自由榜，共${pool._count.poolAnime}部作品`}');
    expect(source).toContain("pool._count.poolAnime");
    expect(source).not.toContain('自由排榜 →');
    expect(source).toContain('aria-hidden="true"');
  });

  it("uses a flexible mobile search row with a non-wrapping submit button", () => {
    expect(source).toContain('role="search"');
    expect(source).toContain('className="anime-field min-w-0 flex-1 sm:w-56"');
    expect(source).toContain('shrink-0 whitespace-nowrap');
    expect(source).toContain('sm:flex-row sm:items-center sm:justify-between');
    expect(source).toContain('id="tier-pool-search"');
  });

  it("preserves public and personal routes and pagination", () => {
    expect(source).toContain('searchParams.view === "mine"');
    expect(source).toContain('href="/tierlists"');
    expect(source).toContain('href="/pools/new"');
    expect(source).toContain('name: { contains: q');
    expect(source).toContain('skip: (page - 1) * 12');
    expect(source).toContain('第 {page} / {Math.ceil(count / 12)} 页');
  });
});
