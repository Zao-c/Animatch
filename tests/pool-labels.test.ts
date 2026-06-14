import { describe, expect, it } from "vitest";
import {
  formatOfficialDemo,
  formatPoolManagementStatus,
  formatPoolVisibility,
  POOL_VISIBILITY_OPTIONS
} from "../src/lib/pool-labels";

describe("pool labels", () => {
  it("formats visibility badges without placeholder question marks", () => {
    expect(formatPoolVisibility("PUBLIC")).toBe("公开");
    expect(formatPoolVisibility("PRIVATE")).toBe("私有");
    expect(formatPoolVisibility("UNLISTED")).toBe("未列出");
    expect(formatOfficialDemo(true)).toBe("官方 Demo");
  });

  it("keeps visibility option copy aligned with the public pool UI", () => {
    expect(POOL_VISIBILITY_OPTIONS).toEqual([
      {
        value: "PRIVATE",
        label: "私有",
        description: "只有创建者可以查看和对决"
      },
      {
        value: "UNLISTED",
        label: "未列出",
        description: "有链接的人可以浏览，登录后可以开始自己的个人对决"
      },
      {
        value: "PUBLIC",
        label: "公开",
        description: "所有人可以在公开番组列表中看到，登录后可以开始自己的个人对决"
      }
    ]);
  });

  it("formats pool card status labels without placeholder question marks", () => {
    expect(formatPoolManagementStatus("ARCHIVED")).toBe("已归档");
    expect(formatPoolManagementStatus("EMPTY")).toBe("未添加动画");
    expect(formatPoolManagementStatus("READY")).toBe("可开始");
    expect(formatPoolManagementStatus("IN_PROGRESS")).toBe("对决中");
    expect(formatPoolManagementStatus("STABLE")).toBe("已稳定");
  });
});
