import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { textInput } from "@/lib/anisong/validation";
import { searchNetease } from "@/lib/anisong/netease/api";
import { readNeteaseAccount } from "@/lib/anisong/netease/accounts";
import { limitNetease } from "@/lib/anisong/netease/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser(); limitNetease(user.id, "search", 20);
    const query = textInput(new URL(request.url).searchParams.get("q"), "关键词", 100, true);
    const account = await readNeteaseAccount(user.id);
    return ok({ songs: await searchNetease(query, account.cookie || "") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fromError(error); }
}
