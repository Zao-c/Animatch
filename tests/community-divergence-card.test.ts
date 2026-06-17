import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityDivergenceCard } from "../src/components/CommunityDivergenceCard";
import type { DivergenceResult } from "../src/lib/community-divergence";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function makeDivergenceResult(overrides: Partial<DivergenceResult> = {}): DivergenceResult {
  return {
    userLikesMore: null,
    userLikesLess: null,
    mostAligned: null,
    insufficientCommunity: false,
    insufficientPersonal: false,
    ...overrides
  };
}

function makeDivergenceItem(overrides: Record<string, unknown> = {}) {
  return {
    animeId: "anime-1",
    title: "冰菓",
    imageUrl: "https://example.com/hyouka.jpg",
    personalTierLabel: "S",
    personalTierIndex: 0,
    communityTierLabel: "B",
    communityTierIndex: 2,
    divergence: -2,
    participantCount: 5,
    ...overrides
  };
}

describe("CommunityDivergenceCard", () => {
  describe("source inspection", () => {
    const source = readFileSync(
      "src/components/CommunityDivergenceCard.tsx",
      "utf8"
    );

    it("contains title text", () => {
      expect(source).toContain("你和社区的最大分歧");
    });

    it("renders user likes more section", () => {
      expect(source).toContain("你比社区更喜欢");
    });

    it("renders user likes less section", () => {
      expect(source).toContain("你比社区更不喜欢");
    });

    it("renders most aligned section", () => {
      expect(source).toContain("你们最一致");
    });

    it("shows insufficient personal data message", () => {
      expect(source).toContain("先完成几轮对决");
    });

    it("shows sample warning when participant count is low", () => {
      expect(source).toContain("社区样本还少");
    });

    it("shows close taste message when no divergence", () => {
      expect(source).toContain("你和社区口味很接近");
    });

    it("uses AnimeCover for image display", () => {
      expect(source).toContain('import { AnimeCover } from "./AnimeCover"');
      expect(source).toContain("size=\"sm\"");
    });

    it("uses AppCard for container", () => {
      expect(source).toContain('import { AppCard } from "./ui/AppCard"');
    });
  });

  describe("rendered output", () => {
    it("shows insufficientPersonal message", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({ insufficientPersonal: true })
        })
      );

      expect(html).toContain("先完成几轮对决");
      expect(html).not.toContain("你比社区更喜欢");
    });

    it("shows close taste message when all divergences are null", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult()
        })
      );

      expect(html).toContain("你和社区口味很接近");
    });

    it("shows likes-more row with correct text", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({
            userLikesMore: makeDivergenceItem({
              title: "冰菓",
              personalTierLabel: "S",
              communityTierLabel: "B"
            }) as DivergenceResult["userLikesMore"]
          })
        })
      );

      expect(html).toContain("你比社区更喜欢");
      expect(html).toContain("S");
      expect(html).toContain("B");
      expect(html).toContain("冰菓");
    });

    it("shows likes-less row with correct text", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({
            userLikesLess: makeDivergenceItem({
              title: "进击的巨人",
              personalTierLabel: "C",
              communityTierLabel: "A",
              divergence: 2
            }) as DivergenceResult["userLikesLess"]
          })
        })
      );

      expect(html).toContain("你比社区更不喜欢");
      expect(html).toContain("C");
      expect(html).toContain("A");
      expect(html).toContain("进击的巨人");
    });

    it("shows aligned row with correct text", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({
            mostAligned: makeDivergenceItem({
              title: "轻音少女",
              personalTierLabel: "A",
              communityTierLabel: "A",
              divergence: 0
            }) as DivergenceResult["mostAligned"]
          })
        })
      );

      expect(html).toContain("你们最一致");
      expect(html).toContain("轻音少女");
    });

    it("does not show any row sections when all are null", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult()
        })
      );

      expect(html).not.toContain("你比社区更喜欢");
      expect(html).not.toContain("你比社区更不喜欢");
      expect(html).not.toContain("你们最一致");
    });

    it("contains cover placeholder in each divergence row", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({
            userLikesMore: makeDivergenceItem() as DivergenceResult["userLikesMore"],
            userLikesLess: makeDivergenceItem({
              title: "巨人",
              imageUrl: "https://example.com/kyojin.jpg"
            }) as DivergenceResult["userLikesLess"],
            mostAligned: makeDivergenceItem({
              title: "轻音",
              imageUrl: "https://example.com/keion.jpg"
            }) as DivergenceResult["mostAligned"]
          })
        })
      );

      expect(html).toContain("data-cover-fit=\"cover\"");
    });

    it("does not render when insufficientCommunity", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({ insufficientCommunity: true })
        })
      );

      expect(html).toBe("");
    });

    it("renders sample warning for low participant count", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({
            userLikesMore: makeDivergenceItem({
              participantCount: 2
            }) as DivergenceResult["userLikesMore"]
          })
        })
      );

      expect(html).toContain("社区样本还少");
    });

    it("render uses flex layout for mobile stacking", () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityDivergenceCard, {
          result: makeDivergenceResult({
            userLikesMore: makeDivergenceItem() as DivergenceResult["userLikesMore"]
          })
        })
      );

      expect(html).toContain("space-y-4");
    });
  });
});
