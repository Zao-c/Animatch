import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Older cached clients must not save a setting that no longer has any effect.
export async function PATCH() {
  return NextResponse.json(
    { ok: false, error: { message: "口味画像和匹配现在自动开放，此设置已停用。请刷新页面。" } },
    { status: 410 }
  );
}
