import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchHeading } from "@/components/MatchPresentation";

describe("shared match heading", () => {
  it.each([
    ["personal", "个人自由对决", "返回番组"],
    ["season", "赛季投票", "返回赛季"],
    ["music", "音乐对决", "返回曲单"]
  ] as const)("preserves the public labels and navigation for %s", (mode, label, backLabel) => {
    const html = renderToStaticMarkup(createElement(MatchHeading, {
      mode, title: "My match", backHref: "/destination", description: "Help text"
    }));
    expect(html).toContain(label);
    expect(html).toContain(backLabel);
    expect(html).toContain('href="/destination"');
    expect(html).toContain("My match");
    expect(html).toContain("Help text");
  });
});
