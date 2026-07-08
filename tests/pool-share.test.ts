import { describe, expect, it } from "vitest";
import {
  buildPoolShareText,
  canSharePoolLink,
  getPoolShareBlockedNotice,
  getPoolShareButtonLabel
} from "../src/lib/pool-share";

describe("pool share copy", () => {
  it("does not treat private pools as shareable", () => {
    expect(canSharePoolLink("PRIVATE")).toBe(false);
    expect(getPoolShareButtonLabel("PRIVATE")).toBe("分享前先公开");
    expect(getPoolShareBlockedNotice()).toContain("私有状态");
    expect(getPoolShareBlockedNotice()).toContain("未列出或公开");
  });

  it("allows unlisted and public pools to copy a direct match link", () => {
    expect(canSharePoolLink("UNLISTED")).toBe(true);
    expect(canSharePoolLink("PUBLIC")).toBe(true);
    expect(getPoolShareButtonLabel("UNLISTED")).toBe("分享番组");
    expect(getPoolShareButtonLabel("PUBLIC")).toBe("分享番组");
  });

  it("uses visibility-specific copy for copied share text", () => {
    const unlisted = buildPoolShareText({
      name: "四月新番",
      url: "https://example.test/pools/pool-1",
      visibility: "UNLISTED"
    });
    const publicText = buildPoolShareText({
      name: "四月新番",
      url: "https://example.test/pools/pool-1",
      visibility: "PUBLIC"
    });

    expect(unlisted).toContain("AniMatch 番组《四月新番》");
    expect(unlisted).toContain("知道链接的人可以浏览");
    expect(publicText).toContain("打开后登录即可开始对决。");
  });
});
