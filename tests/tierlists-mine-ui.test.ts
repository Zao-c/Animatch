import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("my Tier List page hierarchy and history access", () => {
  const source = readFileSync("src/app/tierlists/page.tsx", "utf8");
  const personal = source.slice(
    source.indexOf('if (searchParams.view === "mine")'),
    source.indexOf('const q = typeof searchParams.q')
  );

  it("renders drafts before the share history as stacked sections", () => {
    expect(personal).not.toContain('lg:grid-cols-2"');
    expect(personal).toContain('aria-labelledby="my-tier-drafts-title"');
    expect(personal).toContain('aria-labelledby="my-tier-shares-title"');
    expect(personal.indexOf('id="my-tier-drafts-title"')).toBeLessThan(
      personal.indexOf('id="my-tier-shares-title"')
    );
    expect(personal).toContain('md:grid-cols-2 xl:grid-cols-3');
  });

  it("groups share history by run without discarding older tokens", () => {
    expect(personal).toContain('groupTierSharesByRun(myShares)');
    expect(personal).toContain('prisma.tierShare.groupBy(');
    expect(personal).toContain('by: ["runId"]');
    expect(personal).toContain('const shareCount = shareRuns.reduce(');
    expect(personal).toContain('history.map((share)');
    expect(personal).toContain('href={`/share/tier/${share.token}`}');
    expect(personal).toContain('href={`/share/tier/${latest.token}`}');
    expect(personal).toContain('历史版本（{history.length}）');
    expect(personal).toContain('最新版本');
  });

  it("distinguishes individual versions by date rather than duplicating the pool name", () => {
    expect(personal).toContain('formatDateTimeStable(latest.createdAt)');
    expect(personal).toContain('formatDateTimeStable(share.createdAt)');
    expect(personal).toContain('latest.run.pool.name !== latest.title');
  });

  it("paginates by run so one list does not split a run's history between pages", () => {
    expect(personal).toContain('const sharePageSize = 12');
    expect(personal).not.toContain("prisma.tierShare.count(");
    expect(personal).toContain('.slice((sharePage - 1) * sharePageSize, sharePage * sharePageSize)');
    expect(personal).toContain('runId: { in: pageRunIds }');
    expect(personal).toContain('sharePage=${sharePage - 1}');
    expect(personal).toContain('sharePage=${sharePage + 1}');
    expect(personal).toContain('where: sharesWhere');
  });

  it("keeps the personal list access controlled by authenticated user id", () => {
    expect(personal).toContain('if (!user) redirect(');
    expect(personal).toContain('const sharesWhere = { run: { userId: user.id } }');
    expect(personal).toContain('ownerId: user.id');
  });
});
