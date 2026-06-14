import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApiClientError } from "../src/lib/client-api";
import { getPoolAccessStateCopy, getPoolAccessStateFromError } from "../src/lib/pool-access-state";

describe("pool detail access states", () => {
  it("maps private pool 403 responses to a friendly no-permission state", () => {
    const state = getPoolAccessStateFromError(new ApiClientError("Forbidden", 403));
    const copy = getPoolAccessStateCopy(state ?? "not-found");

    expect(state).toBe("forbidden");
    expect(copy.title).toBe("你没有权限访问这个番组");
    expect(copy.description).toContain("这个番组是私有的");
    expect(copy.actions).toEqual([
      { href: "/pools?view=public", label: "去公开番组", variant: "primary" },
      { href: "/", label: "返回首页", variant: "secondary" }
    ]);
    expect(`${copy.title} ${copy.description}`).not.toContain("作品墙");
    expect(`${copy.title} ${copy.description}`).not.toContain("编辑番组");
  });

  it("maps 401 responses to a login prompt", () => {
    const state = getPoolAccessStateFromError(new ApiClientError("Unauthorized", 401));
    const copy = getPoolAccessStateCopy(state ?? "not-found");

    expect(state).toBe("login-required");
    expect(copy.title).toBe("请先登录");
    expect(copy.actions).toContainEqual({ href: "/login", label: "去登录", variant: "primary" });
    expect(copy.actions).toContainEqual({
      href: "/pools?view=public",
      label: "去公开番组",
      variant: "secondary"
    });
  });

  it("keeps normal pool detail rendering separate from access errors", () => {
    const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

    expect(detailSource).toContain("PoolAccessStateCard");
    expect(detailSource).toContain('accessState ?? "not-found"');
    expect(detailSource).toContain("canManagePool");
    expect(detailSource).toContain("canPlayPool");
  });
});

describe("mobile overflow guard", () => {
  const files = [
    "src/app/page.tsx",
    "src/app/pools/page.tsx",
    "src/app/pools/[poolId]/page.tsx",
    "src/app/pools/[poolId]/runs/[runId]/match/page.tsx",
    "src/app/pools/[poolId]/runs/[runId]/tier/page.tsx"
  ];

  it("does not introduce page-level fixed desktop widths", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");

      expect(source, file).not.toMatch(/(?:w|mini?-w)-\[1264px\]/);
      expect(source, file).not.toMatch(/\b(?:w|mini?-w)-screen\b/);
    }
  });
});
