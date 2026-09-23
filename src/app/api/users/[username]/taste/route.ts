
import { fromError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { getTasteProfile } from "@/lib/taste-service";
import { AppError } from "@/lib/app-error";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { username: string } }) { try {
 const user = await getCurrentUser(); const value = new URL(request.url).searchParams.get("year"); const year = value ? Number(value) : undefined;
 if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) throw new AppError("年份无效", 400);
 return ok(await getTasteProfile(params.username, user?.id, year), { headers: { "Cache-Control": "private, no-store" } });
} catch(e) { return fromError(e); } }
