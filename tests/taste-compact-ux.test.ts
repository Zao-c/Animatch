import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compact taste UI with meaningful comparison evidence", () => {
  const taste = readFileSync("src/components/TasteDashboard.tsx", "utf8");
  const rivalry = readFileSync("src/components/TasteRivalryCard.tsx", "utf8");
  const profile = readFileSync("src/app/u/[username]/page.tsx", "utf8");
  const tabs = readFileSync("src/components/ui/DashboardTabs.tsx", "utf8");

  it("shows personal taste by default, with comparison as an explicit second tab", () => {
    expect(taste).toContain('useState<"taste" | "matches">("taste")');
    expect(taste).toContain('setTab("taste")');
    expect(taste).toContain('label: "与别人比较"');
    expect(taste).toContain('role="tabpanel"');
    expect(taste).not.toContain("口味搭子与分歧");
  });

  it("keeps the actual comparison score and sample caveat but hides heavy evidence until requested", () => {
    expect(taste).toContain("排序相似度");
    expect(taste).toContain("至少需要 5 部");
    expect(taste).toContain("不是统计置信度");
    expect(taste).toContain("样本较少");
    expect(taste).toContain('summary className="flex min-h-9');
    expect(taste).toContain("查看对比作品");
    expect(taste).not.toContain("Elo</span>");
  });

  it("guards updates from requests that completed after changing user, tab or scope", () => {
    expect(taste).toContain("if (abort.signal.aborted) return");
    expect(taste).toContain("if (!abort.signal.aborted) setMatches(result)");
    expect(rivalry).toContain("result && !controller.signal.aborted");
  });

  it("keeps the public rivalry panel brief without antagonistic labels", () => {
    expect(rivalry).toContain("查看分歧作品");
    expect(rivalry).toContain("公开参与者");
    expect(rivalry).toContain("排序相似度");
    expect(rivalry).not.toContain("本赛季最有仇");
  });

  it("keeps the five profile tabs on one scrollable row on narrow screens", () => {
    expect(profile).toContain('label="公开内容" mobileScroll');
    expect(tabs).toContain("mobileScroll = false");
    expect(tabs).toContain("flex-nowrap overflow-x-auto");
  });
});
