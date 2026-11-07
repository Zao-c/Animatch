import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { appButtonClasses } from "@/components/ui/AppButton";
import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { formatDateTimeStable } from "@/lib/date-format";
import { groupTierSharesByRun } from "@/lib/tier-share-list";
export const dynamic = "force-dynamic";
export default async function TierListsPage({ searchParams }: { searchParams: { q?: string; page?: string; view?: string; sharePage?: string } }) {
  const user = await getCurrentUser();
  if (searchParams.view === "mine") {
    if (!user) redirect("/login?next=" + encodeURIComponent("/tierlists?view=mine"));

    const sharePage = Math.max(1, Math.min(10000, Number.parseInt(searchParams.sharePage ?? "1", 10) || 1));
    const sharePageSize = 36;
    const sharesWhere = { run: { userId: user.id } };
    const [myDrafts, myShares, shareCount] = await Promise.all([
      prisma.manualTierBoard.findMany({
        where: { ownerId: user.id, pool: { deletedAt: null,
          OR: [{ creatorId: user.id }, { visibility: { in: ["PUBLIC", "UNLISTED"] } }] } },
        select: { poolId: true, title: true, shareToken: true },
        orderBy: { updatedAt: "desc" }, take: 60
      }),
      prisma.tierShare.findMany({
        where: sharesWhere,
        select: {
          token: true, title: true, createdAt: true, runId: true,
          run: { select: { pool: { select: { name: true } } } }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: sharePageSize,
        skip: (sharePage - 1) * sharePageSize
      }),
      prisma.tierShare.count({ where: sharesWhere })
    ]);
    const totalSharePages = Math.max(1, Math.ceil(shareCount / sharePageSize));
    if (sharePage > totalSharePages) {
      redirect(`/tierlists?view=mine&sharePage=${totalSharePages}`);
    }
    const shareGroups = groupTierSharesByRun(myShares);

    return (
      <PageShell>
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">我的榜单</h1>
            <Link href="/tierlists" className={appButtonClasses({ variant: "secondary" })}>制作新榜单</Link>
          </header>

          <section aria-labelledby="my-tier-drafts-title" className="min-w-0 space-y-3">
            <h2 id="my-tier-drafts-title" className="text-lg font-semibold text-white">
              我的自由榜 <span className="ml-1 text-xs font-normal text-slate-400">{myDrafts.length}</span>
            </h2>
            {myDrafts.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {myDrafts.map((draft) => (
                  <Link
                    key={draft.poolId}
                    href={`/pools/${draft.poolId}/tier-maker`}
                    aria-label={`继续编辑${draft.title}`}
                    className="group flex min-h-24 min-w-0 flex-col justify-between rounded-xl border border-cyan-300/25 bg-slate-950/40 p-4 transition-colors hover:border-cyan-300/50 hover:bg-cyan-300/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                  >
                    <h3 className="truncate font-semibold text-white" title={draft.title}>{draft.title}</h3>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{draft.shareToken ? "已分享" : "草稿"}</span>
                      <span aria-hidden="true" className="text-cyan-200">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">还没有保存自由榜。</p>
            )}
          </section>

          <section aria-labelledby="my-tier-shares-title" className="min-w-0 space-y-3">
            <h2 id="my-tier-shares-title" className="text-lg font-semibold text-white">
              已分享的 Tier List <span className="ml-1 text-xs font-normal text-slate-400">{shareCount}</span>
            </h2>
            {shareGroups.length ? (
              <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shareGroups.map(({ runId, latest, history }) => (
                  <article key={runId} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h3 className="min-w-0 truncate font-semibold text-white" title={latest.title}>{latest.title}</h3>
                      {history.length > 0 ? (
                        <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400">
                          {history.length + 1} 版
                        </span>
                      ) : null}
                    </div>
                    {latest.run.pool.name !== latest.title ? (
                      <p className="mt-1 truncate text-xs text-slate-400" title={latest.run.pool.name}>{latest.run.pool.name}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">
                      最近分享 <time dateTime={latest.createdAt.toISOString()}>{formatDateTimeStable(latest.createdAt)}</time>
                    </p>
                    <Link
                      href={`/share/tier/${latest.token}`}
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300/50 hover:bg-cyan-300/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                    >
                      查看最新版本 <span aria-hidden="true">→</span>
                    </Link>
                    {history.length > 0 ? (
                      <details className="mt-3 border-t border-white/10 pt-1">
                        <summary className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-1 text-sm text-slate-300 hover:text-white">
                          历史版本（{history.length}）
                          <span aria-hidden="true">⌄</span>
                        </summary>
                        <ol className="space-y-1 pb-1">
                          {history.map((share) => (
                            <li key={share.token}>
                              <Link
                                href={`/share/tier/${share.token}`}
                                aria-label={`查看${share.title}于${formatDateTimeStable(share.createdAt)}分享的历史版本`}
                                className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg px-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                              >
                                <time dateTime={share.createdAt.toISOString()}>{formatDateTimeStable(share.createdAt)}</time>
                                <span aria-hidden="true" className="shrink-0">→</span>
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">还没有分享 Tier List。</p>
            )}
            {totalSharePages > 1 ? (
              <nav aria-label="分享历史分页" className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {sharePage > 1 ? (
                  <Link href={`/tierlists?view=mine&sharePage=${sharePage - 1}`} className={appButtonClasses({ variant: "ghost" })}>上一页</Link>
                ) : null}
                <span className="text-sm text-slate-400">第 {sharePage} / {totalSharePages} 页</span>
                {sharePage < totalSharePages ? (
                  <Link href={`/tierlists?view=mine&sharePage=${sharePage + 1}`} className={appButtonClasses({ variant: "ghost" })}>下一页</Link>
                ) : null}
              </nav>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
            <Link href="/anisong/mine" className={appButtonClasses({ variant: "secondary" })}>我的音乐曲单</Link>
          </div>
        </div>
      </PageShell>
    );
  }
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
  const totalPages = Math.max(1, Math.ceil(count / 12));
  if (page > totalPages) redirect(`/tierlists?q=${encodeURIComponent(q)}&page=${totalPages}`);
  return <PageShell><div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold tracking-tight">自由排榜</h1>
      <Link href="/pools/new" className={appButtonClasses({ variant: "secondary" })}>创建番组</Link></header>
    {!user && <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm">登录后可保存榜单。</p>}
    {drafts.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-white">继续我的榜单</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{drafts.map((draft, index) => (
        <Link
          key={draft.poolId}
          href={`/pools/${draft.poolId}/tier-maker`}
          aria-label={`继续编辑${draft.title}`}
          className={`group flex min-h-24 flex-col justify-between rounded-xl border p-4 transition-colors hover:border-cyan-300/60 hover:bg-cyan-300/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${index === 0 ? "border-cyan-300/45 bg-cyan-300/[0.07]" : "border-white/10 bg-slate-950/40"}`}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h3 className="min-w-0 truncate font-semibold text-white">{draft.title}</h3>
            <span aria-hidden="true" className="shrink-0 text-cyan-200 transition-transform group-hover:translate-x-0.5">→</span>
          </div>
          <span className="mt-2 text-xs text-slate-400">{draft.shareToken ? "已分享" : "私人草稿"}</span>
        </Link>
      ))}</div></section>}
    <section><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold">番组</h2><form action="/tierlists" role="search" className="flex w-full min-w-0 items-center gap-2 sm:w-auto"><label className="sr-only" htmlFor="tier-pool-search">搜索番组</label><input id="tier-pool-search" name="q" defaultValue={q} placeholder="搜索番组" className="anime-field min-w-0 flex-1 sm:w-56" /><button type="submit" className={appButtonClasses({ variant: "secondary", className: "shrink-0 whitespace-nowrap" })}>搜索</button></form></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pools.map((pool) => (
        <Link
          key={pool.id}
          href={`/pools/${pool.id}/tier-maker`}
          aria-label={`为${pool.name}制作自由榜，共${pool._count.poolAnime}部作品`}
          className="group flex min-h-24 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4 transition-colors hover:border-cyan-300/45 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-white">{pool.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{pool._count.poolAnime} 部作品</p>
          </div>
          <span aria-hidden="true" className="shrink-0 text-lg text-cyan-200/80 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      ))}</div>
      {!pools.length && <p className="py-8 text-slate-400">没有找到番组，可以换个关键词，或创建番组。</p>}
      {count > 12 && <nav aria-label="番组分页" className="mt-4 flex items-center justify-center gap-4">{page > 1 && <Link className={appButtonClasses({ variant: "ghost" })} href={`/tierlists?q=${encodeURIComponent(q)}&page=${page - 1}`}>上一页</Link>}<span className="text-sm text-slate-400">第 {page} / {Math.ceil(count / 12)} 页</span>{page * 12 < count && <Link className={appButtonClasses({ variant: "ghost" })} href={`/tierlists?q=${encodeURIComponent(q)}&page=${page + 1}`}>下一页</Link>}</nav>}
    </section>
  </div></PageShell>;
}
