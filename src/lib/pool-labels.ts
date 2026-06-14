export type PoolVisibilityValue = "PRIVATE" | "UNLISTED" | "PUBLIC";

export const POOL_VISIBILITY_OPTIONS: {
  value: PoolVisibilityValue;
  label: string;
  description: string;
}[] = [
  {
    value: "PRIVATE",
    label: "私有",
    description: "只有你能查看和对决"
  },
  {
    value: "UNLISTED",
    label: "未列出",
    description: "知道链接的人可以浏览，登录后可以开始自己的个人对决"
  },
  {
    value: "PUBLIC",
    label: "公开",
    description: "会出现在公开番组页，登录后任何人都可以开始自己的个人对决"
  }
];

export function formatPoolVisibility(value: string | null | undefined): string {
  switch (value) {
    case "PUBLIC":
      return "公开";
    case "PRIVATE":
      return "私有";
    case "UNLISTED":
      return "未列出";
    default:
      return "未知";
  }
}

export function formatPoolManagementStatus(value: string | null | undefined): string {
  switch (value) {
    case "ARCHIVED":
      return "已归档";
    case "EMPTY":
      return "未添加动画";
    case "READY":
      return "可开始";
    case "IN_PROGRESS":
      return "对决中";
    case "STABLE":
      return "已稳定";
    default:
      return "未知状态";
  }
}

export function formatOfficialDemo(isOfficialDemo: boolean | null | undefined): string | null {
  return isOfficialDemo ? "官方 Demo" : null;
}
