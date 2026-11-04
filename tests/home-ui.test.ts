import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../src/app/page";
import { loadHomeContinueAction } from "../src/components/HomeActions";
import { AppBadge } from "../src/components/ui/AppBadge";
import { AppButton } from "../src/components/ui/AppButton";
import { AppCard } from "../src/components/ui/AppCard";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("home page UI refresh", () => {
  it("renders a concise heading, actions, and match preview", () => {
    const html = renderToStaticMarkup(React.createElement(Home));

    expect(html).toContain("动画对决");
    expect(html).toContain("音乐对决");
    expect(html).toContain("AniMatch");
    expect(html).toContain("mini match demo");
    expect(html).not.toContain("三步生成榜单");
    expect(html).not.toContain("选出心头好");
  });
});

describe("home page preview copy", () => {
  it("keeps the preview concise instead of a marketing introduction", () => {
    const source = readFileSync("src/app/page.tsx", "utf8");
    const preview = readFileSync("src/components/home/HomeMiniMatchDemo.tsx", "utf8");

    expect(source).toContain("HomeActions");
    expect(source).toContain("HomeMiniMatchDemo");
    expect(source).not.toContain("从公开番组体验一次大乱斗");
    expect(preview).toContain("对决预览");
  });
});

describe("home mini match demo source", () => {
  const source = readFileSync("src/components/home/HomeMiniMatchDemo.tsx", "utf8");

  it("keeps mini demo choices local and avoids formal comparison writes", () => {
    expect(source).toContain("choose(\"left\")");
    expect(source).toContain("choose(\"draw\")");
    expect(source).toContain("choose(\"right\")");
    expect(source).toContain("createDemoPool");
    expect(source).not.toContain("submitComparison");
  });

  it("locks mini demo choices during transition feedback", () => {
    expect(source).toContain("choice !== null");
    expect(source).toContain("choiceAdvanceTimerRef");
    expect(source).toContain("window.clearTimeout");
    expect(source).toContain("disabled={disabled}");
    expect(source).toContain("disabled={choice !== null}");
  });

  it("identifies preview works with their actual titles", () => {
    expect(source).toContain("title={title}>{title}</p>");
    expect(source).not.toContain('side === "left" ? "这边" : "那边"');
  });
});

describe("HomeActions entry points", () => {
  const source = readFileSync("src/components/HomeActions.tsx", "utf8");
  it("makes anime and music navigation equally discoverable", () => {
    expect(source).toContain("动画对决");
    expect(source).toContain("音乐对决");
    expect(source).toContain('href="/pools?view=public"');
    expect(source).toContain('href="/anisong"');
    expect(source).not.toContain("体验示例番组");
  });
});

describe("home continue action", () => {
  it("treats dashboard errors as an absent optional recommendation", async () => {
    await expect(loadHomeContinueAction(async () => {
      throw new Error("dashboard unavailable");
    })).resolves.toBeNull();
  });

  it("returns a valid unfinished run when the dashboard is available", async () => {
    await expect(loadHomeContinueAction(async () => ({
      miniMatchPreview: {
        source: "CONTINUE_RUN",
        ctaHref: "/pools/p1/runs/r1/match",
        ctaLabel: "继续对决"
      }
    }))).resolves.toEqual({
      href: "/pools/p1/runs/r1/match",
      label: "继续对决"
    });
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
