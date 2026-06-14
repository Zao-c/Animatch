import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../src/app/page";
import { AppBadge } from "../src/components/ui/AppBadge";
import { AppButton } from "../src/components/ui/AppButton";
import { AppCard } from "../src/components/ui/AppCard";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("home page UI refresh", () => {
  it("renders the value proposition, CTAs, mini match preview, and three-step flow", () => {
    const html = renderToStaticMarkup(React.createElement(Home));

    expect(html).toContain("用左右选择，生成你的动画 Tier List");
    expect(html).toContain("番剧擂台");
    expect(html).toContain("正在准备真实对决预览");
    expect(html).toContain("添加动画");
    expect(html).toContain("开始对决");
    expect(html).toContain("生成榜单");
  });
});

describe("home mini match demo source", () => {
  const source = readFileSync("src/components/home/HomeMiniMatchDemo.tsx", "utf8");

  it("keeps mini demo choices local and avoids formal comparison writes", () => {
    expect(source).toContain("演示选择不会保存");
    expect(source).toContain("choose(\"left\")");
    expect(source).toContain("choose(\"draw\")");
    expect(source).toContain("choose(\"right\")");
    expect(source).toContain("createDemoPool");
    expect(source).not.toContain("submitComparison");
  });
});

describe("HomeActions anonymous state", () => {
  const source = readFileSync("src/components/HomeActions.tsx", "utf8");

  it("shows anonymous CTA when not logged in", () => {
    expect(source).toContain("浏览公开番组");
    expect(source).toContain("立即登录");
    expect(source).toContain("不用登录也能浏览公开番组");
    expect(source).toContain("登录后可以创建自己的番组");
  });

  it("distinguishes null user from logged-in user in getMe response", () => {
    expect(source).toContain("data.user !== null");
  });

  it("shows logged-in CTA when authenticated", () => {
    expect(source).toContain("继续对决");
    expect(source).toContain("查看我的番组");
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
