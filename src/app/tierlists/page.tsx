import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { appButtonClasses } from "@/components/ui/AppButton";
import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function TierListsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const user = await getCurrentUser();
  const q = typeof searchParams.q === "string" ? searchParams.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const where = { deletedAt: null, status: { not: "ARCHIVED" as const },
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    OR: [{ visibility: "PUBLIC" as const }, ...(user ? [{ creatorId: user.id }] : [])] };
  const [pools, count, drafts] = await Promise.all([
    prisma.customPool.findMany({ where, select: { id: true, name: true, _count: { select: { poolAnime: true } } }, orderBy: { updatedAt: "desc" }, take: 12, skip: (page - 1) * 12 }),
    prisma.customPool.count({ where }),
    user ? prisma.manualTierBoard.findMany({ where: { ownerId: user.id, pool: { deletedAt: null, OR: [{ creatorId: user.id }, { visibility: { in: ["PUBLIC", "UNLISTED"] } }] } }, select: { poolId: true, title: true, shareToken: true }, orderBy: { updatedAt: "desc" } }) : []
  ]);
  return <PageShell><div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-cyan-200">自由排榜</p><h1 className="mt-2 text-3xl font-black">我的 Tier List</h1><p className="mt-3 text-slate-400">选一套番组作品，直接拖进档位。按自己的喜好排，保存、分享或导出成图。</p></div>
      <Link href="/pools/new" className={appButtonClasses({ variant: "secondary" })}>创建自己的作品集</Link></header>
    {!user && <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm">可以先挑选番组；登录后即可制作和保存自己的榜单。</p>}
    {drafts.length > 0 && <section><h2 className="mb-3 text-lg font-bold">继续我的榜单</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{drafts.map((draft) => <Link key={draft.poolId} href={`/pools/${draft.poolId}/tier-maker`} className="rounded-2xl border border-cyan-300/25 bg-slate-950/40 p-4 transition hover:border-cyan-300 focus-visible:outline focus-visible:outline-cyan-300"><h3 className="truncate font-bold">{draft.title}</h3><p className="mt-2 text-xs text-slate-400">{draft.shareToken ? "已分享 · 点击继续编辑" : "私人草稿 · 点击继续编辑"}</p></Link>)}</div></section>}
    <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">选择一套作品开始</h2><form action="/tierlists" className="flex max-w-full gap-2"><label className="sr-only" htmlFor="tier-pool-search">搜索番组</label><input id="tier-pool-search" name="q" defaultValue={q} placeholder="搜索番组" className="anime-field min-w-0" /><button type="submit" className={appButtonClasses({ variant: "secondary" })}>搜索</button></form></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pools.map((pool) => <Link key={pool.id} href={`/pools/${pool.id}/tier-maker`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 transition hover:border-cyan-300/50 focus-visible:outline focus-visible:outline-cyan-300"><h3 className="truncate font-bold">{pool.name}</h3><p className="mt-2 text-sm text-slate-400">{pool._count.poolAnime} 部作品</p><p className="mt-5 text-sm font-bold text-cyan-200">开始自由排榜 →</p></Link>)}</div>
      {!pools.length && <p className="py-8 text-slate-400">没有找到番组，可以换个关键词，或创建自己的作品集。</p>}
      {count > 12 && <nav aria-label="番组分页" className="mt-4 flex items-center justify-center gap-4">{page > 1 && <Link className={appButtonClasses({ variant: "ghost" })} href={`/tierlists?q=${encodeURIComponent(q)}&page=${page - 1}`}>上一页</Link>}<span className="text-sm text-slate-400">第 {page} / {Math.ceil(count / 12)} 页</span>{page * 12 < count && <Link className={appButtonClasses({ variant: "ghost" })} href={`/tierlists?q=${encodeURIComponent(q)}&page=${page + 1}`}>下一页</Link>}</nav>}
    </section>
  </div></PageShell>;
}
