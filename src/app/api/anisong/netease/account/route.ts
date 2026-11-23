import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { objectInput } from "@/lib/anisong/validation";
import { boundedBody } from "@/lib/anisong/audio-storage";
import { accountOperation, accountStatus, startNeteaseLogin, pollNeteaseLogin, disconnectNetease } from "@/lib/anisong/netease/accounts";
import { limitNetease } from "@/lib/anisong/netease/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try { const user = await requireCurrentUser(); limitNetease(user.id, "account"); return ok(await accountOperation(user.id, () => accountStatus(user.id)), { headers }); }
  catch (error) { return fromError(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(); limitNetease(user.id, "account");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError("请使用 JSON 请求", 415);
    const bytes = await boundedBody(request, 2048);
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError("JSON 请求格式不正确", 400); }
    const input = objectInput(value);
    const result = await accountOperation(user.id, async () => {
      if (input.action === "start") return startNeteaseLogin(user.id);
      if (input.action === "poll") return pollNeteaseLogin(user.id);
      if (input.action === "disconnect") return disconnectNetease(user.id);
      throw new AppError("不支持的登录操作", 400);
    });
    return ok(result, { headers });
  } catch (error) { return fromError(error); }
}
