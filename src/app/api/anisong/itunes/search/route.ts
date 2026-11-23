import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { searchItunes, itunesCountry } from "@/lib/anisong/itunes/api";
import { textInput } from "@/lib/anisong/validation";
import { limitNetease } from "@/lib/anisong/netease/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser(); limitNetease(user.id, "itunes-search", 20);
    const url = new URL(request.url); const query = textInput(url.searchParams.get("q"), "搜索关键词", 100, true);
    return ok({ songs: await searchItunes(query, itunesCountry(url.searchParams.get("country") || "JP")) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fromError(error); }
}
