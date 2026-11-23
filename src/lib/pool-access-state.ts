import { ApiClientError } from "./client-api";

export type PoolAccessState = "login-required" | "forbidden" | "not-found";

export interface PoolAccessStateCopy {
  title: string;
  description: string;
  actions: Array<{
    href: string;
    label: string;
    variant: "primary" | "secondary";
  }>;
}

export function getPoolAccessStateFromError(error: unknown): PoolAccessState | null {
  if (!(error instanceof ApiClientError)) return null;
  if (error.status === 401) return "login-required";
  if (error.status === 403) return "forbidden";
  if (error.status === 404) return "not-found";
  return null;
}

export function getPoolAccessStateCopy(state: PoolAccessState): PoolAccessStateCopy {
  if (state === "login-required") {
    return {
      title: "请先登录",
      description: "登录后才能查看自己的私有番组。你也可以先去公开番组看看。",
      actions: [
        { href: "/login", label: "去登录", variant: "primary" },
        { href: "/pools?view=public", label: "去公开番组", variant: "secondary" }
      ]
    };
  }

  if (state === "forbidden") {
    return {
      title: "你没有权限访问这个番组",
      description: "这个番组是私有的，只有创建者可以查看。你可以切换账号，或去公开番组看看。",
      actions: [
        { href: "/pools?view=public", label: "去公开番组", variant: "primary" },
        { href: "/", label: "返回首页", variant: "secondary" }
      ]
    };
  }

  return {
    title: "番组不存在",
    description: "这个番组可能已被删除，或当前账号没有访问权限。",
    actions: [
      { href: "/pools?view=public", label: "去公开番组", variant: "primary" },
      { href: "/", label: "返回首页", variant: "secondary" }
    ]
  };
}
