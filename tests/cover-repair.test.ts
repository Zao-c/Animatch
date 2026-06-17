import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoverRepairCard } from "../src/components/CoverRepairCard";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("CoverRepairCard", () => {
  const source = readFileSync(
    "src/components/CoverRepairCard.tsx",
    "utf8"
  );

  it("uses AppCard for container", () => {
    expect(source).toContain('import { AppCard } from "./ui/AppCard"');
  });

  it("uses AnimeCover for image display", () => {
    expect(source).toContain('import { AnimeCover } from "./AnimeCover"');
  });

  it("has scan button text", () => {
    expect(source).toContain("修复导入封面");
  });

  it("has apply button text", () => {
    expect(source).toContain("应用可确定的修复");
  });

  it("shows stats after scan", () => {
    expect(source).toContain("需要修复");
    expect(source).toContain("可自动匹配");
    expect(source).toContain("需手动确认");
  });

  it("shows skipped badge for existing overrides", () => {
    expect(source).toContain("已有修正");
  });

  it("renders with poolId in fetch URL", () => {
    expect(source).toContain("/api/pools/${encodeURIComponent(poolId)}/cover-repair");
  });

  it("shows scan button by default", () => {
    const html = renderToStaticMarkup(
      React.createElement(CoverRepairCard, { poolId: "pool-test-1" })
    );

    expect(html).toContain("修复导入封面");
  });

  it("does not show apply button without scan", () => {
    const html = renderToStaticMarkup(
      React.createElement(CoverRepairCard, { poolId: "pool-test-1" })
    );

    expect(html).not.toContain("应用可确定的修复");
  });

  it("uses AppButton and AppBadge primitives", () => {
    expect(source).toContain('import { AppButton } from "./ui/AppButton"');
    expect(source).toContain('import { AppBadge } from "./ui/AppBadge"');
  });
});

describe("image-proxy route", () => {
  const source = readFileSync(
    "src/app/api/image-proxy/route.ts",
    "utf8"
  );

  it("has User-Agent header for tiermaker requests", () => {
    expect(source).toContain("User-Agent");
  });

  it("has Referer header for tiermaker requests", () => {
    expect(source).toContain("Referer");
    expect(source).toContain("tiermaker.com");
  });

  it("has Accept header for image types", () => {
    expect(source).toContain("Accept");
    expect(source).toContain("image/avif");
  });

  it("returns 502 for upstream failure with dynamic status code", () => {
    expect(source).toContain("502");
    expect(source).toContain("upstream returned");
    expect(source).toContain("response.status");
  });
});

describe("cover-repair API route", () => {
  const source = readFileSync(
    "src/app/api/pools/[poolId]/cover-repair/route.ts",
    "utf8"
  );

  it("requires login via getCurrentUser", () => {
    expect(source).toContain("getCurrentUser()");
    expect(source).toContain("unauthorized");
    expect(source).toContain("请先登录");
  });

  it("checks pool existence", () => {
    expect(source).toContain("Pool not found");
    expect(source).toContain("findUnique");
  });

  it("checks content edit permission via canEditPoolContent", () => {
    expect(source).toContain("canEditPoolContent");
    expect(source).toContain("forbidden");
    expect(source).toContain("你没有权限");
  });

  it("GET scans TIERMAKER_IMPORT and tiermaker.com coverUrl anime", () => {
    expect(source).toContain("TIERMAKER_IMPORT");
    expect(source).toContain('contains: "tiermaker.com"');
  });

  it("GET skips entries with existing coverUrlOverride", () => {
    expect(source).toContain("isCoverOverridden");
    expect(source).toContain('suggestion: "skipped"');
  });

  it("GET searches Bangumi by title for matching", () => {
    expect(source).toContain("searchBangumiAnime");
    expect(source).toContain("findBestBangumiMatch");
  });

  it("GET uses confidence threshold for auto-match", () => {
    expect(source).toContain("HIGH_CONFIDENCE_THRESHOLD");
    expect(source).toContain('suggestion: "auto"');
    expect(source).toContain('suggestion: "manual"');
  });

  it("POST validates entries array", () => {
    expect(source).toContain("invalid json body");
    expect(source).toContain("entries is required");
  });

  it("POST only updates entries without existing override", () => {
    expect(source).toContain("coverUrlOverride: null");
  });

  it("POST writes coverUrlOverride on matched poolAnime", () => {
    expect(source).toContain("coverUrlOverride");
    expect(source).toContain("poolAnime.update");
  });

  it("POST limits max entries", () => {
    expect(source).toContain("MAX_CANDIDATES");
    expect(source).toContain("too many entries");
  });

  it("has findBestBangumiMatch with exact title match", () => {
    expect(source).toContain("confidence: 1.0");
    expect(source).toContain("titleCn ??");
  });

  it("handles pool archived/deleted via pool not found", () => {
    expect(source).toContain("Pool not found");
  });
});

describe("community-ranking use full cover chain", () => {
  const source = readFileSync(
    "src/lib/community-ranking-service.ts",
    "utf8"
  );

  it("imports getAnimeCoverUrl", () => {
    expect(source).toContain('import { getAnimeCoverUrl } from "./anime-cover-url"');
  });

  it("uses getAnimeCoverUrl with hero intent for imageUrl", () => {
    expect(source).toContain("getAnimeCoverUrl");
    expect(source).toContain('intent: "hero"');
  });

  it("includes imageLargeUrl and imageMediumUrl in the fields", () => {
    expect(source).toContain("entry.anime.imageLargeUrl");
    expect(source).toContain("entry.anime.imageMediumUrl");
    expect(source).toContain("entry.anime.imageSmallUrl");
  });

  it("still respects coverUrlOverride from poolAnime", () => {
    expect(source).toContain("entry.coverUrlOverride");
  });
});

describe("pool detail has cover repair entry", () => {
  const source = readFileSync(
    "src/app/pools/[poolId]/page.tsx",
    "utf8"
  );

  it("imports CoverRepairCard", () => {
    expect(source).toContain('import { CoverRepairCard } from "@/components/CoverRepairCard"');
  });

  it("renders CoverRepairCard for editors only", () => {
    expect(source).toContain("canEditContent");
    expect(source).toContain("<CoverRepairCard");
  });
});
