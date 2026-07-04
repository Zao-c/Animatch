import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingProgressCard } from "../src/components/RankingProgressCard";

describe("ranking UI wiring", () => {
  it("Match page shows ranking progress guidance", () => {
    const source = readFileSync(
      "src/app/pools/[poolId]/runs/[runId]/match/page.tsx",
      "utf8"
    );

    expect(source).toContain("RankingProgressCard");
    expect(source).toContain("scoreDistribution");
  });

  it("Tier page shows stage copy near ranking stats", () => {
    const source = readFileSync(
      "src/app/pools/[poolId]/runs/[runId]/tier/page.tsx",
      "utf8"
    );

    expect(source).toContain("当前阶段");
    expect(source).toContain("有效对决");
    expect(source).toContain("RankingProgressCard");
  });

  it("renders stage guidance copy", () => {
    const html = renderToStaticMarkup(
      React.createElement(RankingProgressCard, {
        progress: {
          totalItems: 10,
          effectiveComparisons: 18,
          draftTarget: 15,
          reliableTarget: 30,
          highConfidenceTarget: 50,
          progressRatio: 18 / 50,
          stage: "DRAFT_READY",
          stageLabel: "初稿",
          nextTargetLabel: "达到较可信",
          remainingToNextStage: 12
        }
      })
    );

    expect(html).toContain("当前榜单已完成 18 / 30 场有效对决");
    expect(html).toContain("继续 12 场可达到较可信");
  });
  it("shows overflow progress without impossible target fraction", () => {
    const html = renderToStaticMarkup(
      React.createElement(RankingProgressCard, {
        progress: {
          totalItems: 22,
          effectiveComparisons: 118,
          draftTarget: 33,
          reliableTarget: 66,
          highConfidenceTarget: 110,
          progressRatio: 1,
          stage: "HIGH_CONFIDENCE",
          stageLabel: "高可信",
          nextTargetLabel: "已达到高可信度",
          remainingToNextStage: 0
        }
      })
    );

    expect(html).toContain("118 场 / 目标 110");
    expect(html).toContain("已超过目标 8 场");
    expect(html).not.toContain("118 / 110");
  });
});
