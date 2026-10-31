import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { ok, fromError } from "@/lib/api-response";
import { templateSummary } from "@/lib/anisong/shared/templates";
import { textInput } from "@/lib/anisong/validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const url = new URL(request.url); const search = textInput(url.searchParams.get("q"), "关键词", 100);
    const page = Math.min(1000, Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0)));
    const where = { active: true, ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}) };
    const templates = await prisma.songTemplate.findMany({ where, orderBy: { updatedAt: "desc" }, take: 25, skip: page * 24, include: { owner: { select: { name: true, username: true } } } });
    return ok({ templates: templates.slice(0, 24).map(t => templateSummary(t, user?.id)), hasMore: templates.length > 24 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fromError(error); }
}
