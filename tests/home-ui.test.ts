import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../src/app/page";
import { AppBadge } from "../src/components/ui/AppBadge";
import { AppButton } from "../src/components/ui/AppButton";
import { AppCard } from "../src/components/ui/AppCard";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("home page UI refresh", () => {
  it("renders the value proposition, CTAs, mini match demo, and three-step flow", () => {
    const html = renderToStaticMarkup(React.createElement(Home));

    expect(html).toContain("用左右选择，生成你的动画 Tier List");
    expect(html).toContain("创建第一个番组");
    expect(html).toContain("查看我的番组");
    expect(html).toContain("体验示例番组");
    expect(html).toContain("不用搜索和导入，直接体验二选一对决。");
    expect(html).toContain("Mini match demo");
    expect(html).toContain("VS");
    expect(html).toContain("添加动画");
    expect(html).toContain("开始对决");
    expect(html).toContain("生成榜单");
  });
});

describe("shared UI primitives", () => {
  it("renders AppButton variants without breaking existing output", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AppButton, { variant: "primary" }, "Primary"),
        React.createElement(AppButton, { variant: "secondary" }, "Secondary"),
        React.createElement(AppButton, { variant: "ghost" }, "Ghost"),
        React.createElement(AppButton, { variant: "danger" }, "Danger"),
        React.createElement(AppButton, { variant: "quiet", size: "sm" }, "Quiet")
      )
    );

    expect(html).toContain("Primary");
    expect(html).toContain("Secondary");
    expect(html).toContain("Ghost");
    expect(html).toContain("Danger");
    expect(html).toContain("Quiet");
    expect(html).toContain("cursor-pointer");
  });

  it("renders AppCard and AppBadge variants", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AppCard, { variant: "focus" }, "Focus panel"),
        React.createElement(AppCard, { soft: true }, "Soft panel"),
        React.createElement(AppBadge, { tone: "warning" }, "Warning"),
        React.createElement(AppBadge, { tone: "danger" }, "Danger")
      )
    );

    expect(html).toContain("Focus panel");
    expect(html).toContain("Soft panel");
    expect(html).toContain("Warning");
    expect(html).toContain("Danger");
  });
});
