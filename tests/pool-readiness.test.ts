import { describe, it, expect } from "vitest";
import { buildPoolReadinessReport } from "../src/lib/pool-readiness";
import type { AnimeSourceField } from "../src/lib/pool-readiness";

function fields(overrides: Partial<AnimeSourceField>[]): AnimeSourceField[] {
  return overrides.map((o) => ({
    source: "BANGUMI",
    title: "Test Anime",
    titleCn: "测试动画",
    imageUrl: "https://example.com/img.jpg",
    imageMediumUrl: null,
    imageLargeUrl: null,
    thumbnailUrl: null,
    ...o
  }));
}

function single(overrides: Partial<AnimeSourceField> = {}): AnimeSourceField[] {
  return fields([overrides]);
}

describe("buildPoolReadinessReport", () => {
  it("active anime < 2 returns blocked", () => {
    const report = buildPoolReadinessReport({
      animeCount: 1,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: single()
    });
    expect(report.status).toBe("blocked");
  });

  it("active anime < 8 returns needs_work", () => {
    const report = buildPoolReadinessReport({
      animeCount: 5,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: fields([
        { imageUrl: "https://a.com/1.jpg" },
        { imageUrl: "https://a.com/2.jpg" },
        { imageUrl: "https://a.com/3.jpg" },
        { imageUrl: "https://a.com/4.jpg" },
        { imageUrl: "https://a.com/5.jpg" }
      ])
    });
    expect(report.status).toBe("needs_work");
    expect(report.issues.some((i) => i.kind === "few_anime")).toBe(true);
  });

  it("active anime >= 8 with covers and good titles returns ready", () => {
    const items = fields(Array.from({ length: 8 }, (_, i) => ({
      imageUrl: `https://a.com/${i}.jpg`
    })));
    const report = buildPoolReadinessReport({
      animeCount: 8,
      hasTitle: true,
      hasDescription: true,
      visibility: "PUBLIC",
      animeSourceFields: items
    });
    expect(report.status).toBe("ready");
    expect(report.issues.length).toBe(0);
  });

  it("counts missing covers", () => {
    const report = buildPoolReadinessReport({
      animeCount: 3,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: fields([
        { imageUrl: "https://a.com/1.jpg" },
        { imageUrl: null, imageMediumUrl: null, imageLargeUrl: null, thumbnailUrl: null },
        { imageUrl: null, imageMediumUrl: null, imageLargeUrl: null, thumbnailUrl: null }
      ])
    });
    expect(report.missingCoverCount).toBe(2);
  });

  it("counts suspicious titles", () => {
    const report = buildPoolReadinessReport({
      animeCount: 3,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: fields([
        { title: "未命名", titleCn: null },
        { title: "Untitled", titleCn: null, source: "TIERMAKER_IMPORT" },
        { titleCn: "正常标题" }
      ])
    });
    expect(report.suspiciousTitleCount).toBe(2);
  });

  it("detects image_xxx pattern", () => {
    const report = buildPoolReadinessReport({
      animeCount: 1,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: single({ title: "image_12345", titleCn: null })
    });
    expect(report.suspiciousTitleCount).toBe(1);
  });

  it("detects zzz prefix", () => {
    const report = buildPoolReadinessReport({
      animeCount: 1,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: single({ title: "zzzabc123", titleCn: null })
    });
    expect(report.suspiciousTitleCount).toBe(1);
  });

  it("detects very long TIERMAKER_IMPORT titles", () => {
    const report = buildPoolReadinessReport({
      animeCount: 1,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: single({
        title: "abcdefghijklmnopqrstuvwxyz123456",
        titleCn: null,
        source: "TIERMAKER_IMPORT"
      })
    });
    expect(report.suspiciousTitleCount).toBe(1);
  });

  it("does not flag normal length CUSTOM_UPLOAD titles", () => {
    const report = buildPoolReadinessReport({
      animeCount: 1,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: single({
        title: "Short Title",
        titleCn: null,
        source: "CUSTOM_UPLOAD"
      })
    });
    expect(report.suspiciousTitleCount).toBe(0);
  });

  it("counts source types", () => {
    const report = buildPoolReadinessReport({
      animeCount: 4,
      hasTitle: true,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: [
        { source: "BANGUMI", title: "B", titleCn: "B", imageUrl: "https://x.com/b.jpg" },
        { source: "BANGUMI", title: "B2", titleCn: "B2", imageUrl: "https://x.com/b2.jpg" },
        { source: "TIERMAKER_IMPORT", title: "T", titleCn: "T", imageUrl: "https://x.com/t.jpg" },
        { source: "CUSTOM_UPLOAD", title: "C", titleCn: "C", imageUrl: "https://x.com/c.jpg" }
      ]
    });
    expect(report.sourceTypeCounts["BANGUMI"]).toBe(2);
    expect(report.sourceTypeCounts["TIERMAKER_IMPORT"]).toBe(1);
    expect(report.sourceTypeCounts["CUSTOM_UPLOAD"]).toBe(1);
  });

  it("flags missing title as issue", () => {
    const report = buildPoolReadinessReport({
      animeCount: 8,
      hasTitle: false,
      hasDescription: true,
      visibility: "PRIVATE",
      animeSourceFields: fields(Array.from({ length: 8 }, (_, i) => ({ imageUrl: `https://a.com/${i}.jpg` })))
    });
    expect(report.issues.some((i) => i.kind === "no_title")).toBe(true);
  });

  it("flags missing description as info", () => {
    const report = buildPoolReadinessReport({
      animeCount: 8,
      hasTitle: true,
      hasDescription: false,
      visibility: "PUBLIC",
      animeSourceFields: fields(Array.from({ length: 8 }, (_, i) => ({ imageUrl: `https://a.com/${i}.jpg` })))
    });
    const descIssue = report.issues.find((i) => i.kind === "no_description");
    expect(descIssue).toBeDefined();
    expect(descIssue?.severity).toBe("info");
  });

  it("needs_work status when no title but enough anime", () => {
    const report = buildPoolReadinessReport({
      animeCount: 10,
      hasTitle: false,
      hasDescription: true,
      visibility: "PUBLIC",
      animeSourceFields: fields(Array.from({ length: 10 }, (_, i) => ({ imageUrl: `https://a.com/${i}.jpg` })))
    });
    expect(report.status).toBe("needs_work");
  });
});
