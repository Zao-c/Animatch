import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatFeedbackText } from "../src/components/PlaytestFeedbackButton";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("PlaytestFeedbackButton", () => {
  describe("source inspection", () => {
    const source = readFileSync(
      "src/components/PlaytestFeedbackButton.tsx",
      "utf8"
    );

    it("contains feedback type options", () => {
      expect(source).toContain("不知道下一步点哪里");
      expect(source).toContain("页面/按钮出错");
      expect(source).toContain("图片或封面问题");
      expect(source).toContain("对决体验问题");
      expect(source).toContain("Tier 榜单结果问题");
      expect(source).toContain("文案看不懂");
      expect(source).toContain("其他");
    });

    it("renders feedback button with accessible label", () => {
      expect(source).toContain('aria-label="反馈试玩体验"');
    });

    it("includes copy button and close button", () => {
      expect(source).toContain("复制反馈");
      expect(source).toContain("关闭");
    });

    it("shows manual copy fallback when clipboard fails", () => {
      expect(source).toContain("自动复制失败，请手动复制下方文本");
      expect(source).toContain("manualTextareaRef");
    });

    it("shows copy success feedback", () => {
      expect(source).toContain("已复制，可以直接发给站长");
    });

    it("prompts user when empty but still allows copy", () => {
      expect(source).toContain(
        "可以补充几句话，也可以直接复制页面信息"
      );
    });

    it("uses compact fixed positioning for the trigger button", () => {
      expect(source).toContain("fixed bottom-3 right-3");
      expect(source).toContain("h-10 min-h-10 w-10 min-w-10");
    });

    it("closes on Escape key", () => {
      expect(source).toContain('e.key === "Escape"');
    });

    it("closes on backdrop click", () => {
      expect(source).toContain("onClick={handleClose}");
    });

    it("uses existing copyToClipboard utility", () => {
      expect(source).toContain('import { copyToClipboard } from "@/lib/clipboard"');
    });

    it("uses existing AppButton and AppCard primitives", () => {
      expect(source).toContain('import { AppButton } from "./ui/AppButton"');
      expect(source).toContain('import { AppCard } from "./ui/AppCard"');
    });
  });

  describe("formatFeedbackText", () => {
    it("includes all required sections", () => {
      const text = formatFeedbackText({
        type: "image-cover",
        content: "封面显示错误",
        name: "测试用户",
        pathname: "/pools/pool-123"
      });

      expect(text).toContain("【AniMatch 试玩反馈】");
      expect(text).toContain("时间：");
      expect(text).toContain("页面：/pools/pool-123");
      expect(text).toContain("类型：图片或封面问题");
      expect(text).toContain("封面显示错误");
      expect(text).toContain("测试用户");
      expect(text).toContain("浏览器：");
    });

    it("includes current timestamp in the output", () => {
      const text = formatFeedbackText({
        type: "other",
        content: "test",
        name: "",
        pathname: "/"
      });

      const now = new Date();
      const yearStr = String(now.getFullYear());
      expect(text).toContain(yearStr);
      expect(text).toContain("-");
      expect(text).toContain(":");
    });

    it("shows placeholder name when empty", () => {
      const text = formatFeedbackText({
        type: "other",
        content: "test",
        name: "",
        pathname: "/"
      });

      expect(text).toContain("备注：");
      expect(text).toContain("（未填写）");
    });

    it("shows empty feedback content as blank", () => {
      const text = formatFeedbackText({
        type: "page-error",
        content: "",
        name: "",
        pathname: "/pools"
      });

      expect(text).toContain("反馈：\n\n");
    });

    it("includes user agent when navigator is available", () => {
      const text = formatFeedbackText({
        type: "duel-experience",
        content: "对决卡住了",
        name: "Alice",
        pathname: "/pools/demo/runs/run-1/match"
      });

      expect(text).toContain("Alice");
      expect(text).toContain("对决卡住了");
      expect(text).toContain("页面：/pools/demo/runs/run-1/match");
      expect(text).toContain("类型：对决体验问题");
    });

    it("produces multi-line output with correct separators", () => {
      const text = formatFeedbackText({
        type: "copy-confusing",
        content: "不明白这个按钮",
        name: "Bob",
        pathname: "/pools/test/tier"
      });

      const lines = text.split("\n");
      expect(lines[0]).toBe("【AniMatch 试玩反馈】");
      expect(lines[1]).toMatch(/^时间：\d{4}-\d{2}-\d{2}/);
      expect(lines[2]).toBe("页面：/pools/test/tier");
      expect(lines[3]).toBe("类型：文案看不懂");
      expect(lines[4]).toBe("反馈：");
      expect(lines[5]).toBe("不明白这个按钮");
    });
  });
});
