"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import type { SongBoardView } from "@/lib/anisong/types";
import { SongPlaylistCard } from "./SongPlaylistCard";
import type { SongBoardSummary } from "@/lib/anisong/summary";
import { SongTemplateGallery } from "./SongTemplateGallery";

export type SongLobbyView = "public" | "mine" | "create";

const PAGES: Record<SongLobbyView, { title: string; description: string }> = {
  public: { title: "公开音乐曲单", description: "选择一份 OP、ED 或插入曲曲单，开始自己的音乐对决。" },
  mine: { title: "我的音乐曲单", description: "管理自己创建的曲单，或者继续参与别人的公开曲单。" },
  create: { title: "创建音乐曲单", description: "创建属于你的年度、季度或主题曲单，添加歌曲后即可开始对决。" }
};
const NAV: { id: SongLobbyView; label: string; href: string }[] = [
  { id: "public", label: "公开曲单", href: "/anisong" },
  { id: "mine", label: "我的曲单", href: "/anisong/mine" },
  { id: "create", label: "创建曲单", href: "/anisong/create" }
];

/** Each view has a real route; the lobby does not stack three separate workflows on one page. */
export function SongLobby({ view = "public" }: { view?: SongLobbyView }) {
  const page = PAGES[view];
  return <div className="mx-auto w-full max-w-[90rem] space-y-5 sm:space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{page.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{page.description}</p>
      </div>
      {view === "public" && <Link className={appButtonClasses({ variant: "primary", size: "sm" })} href="/anisong/create">＋ 创建曲单</Link>}
    </header>
    <nav aria-label="音乐曲单导航" className="flex flex-wrap gap-1 rounded-2xl border border-anime-border bg-anime-panel p-1.5">
      {NAV.map(item => <Link key={item.id} href={item.href} aria-current={item.id === view ? "page" : undefined}
        className={"inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition sm:min-h-10 " +
          (item.id === view ? "border border-anime-purple/35 bg-anime-purple/20 text-purple-100" : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-white")}>{item.label}</Link>)}
    </nav>
    {view === "public" ? <SongTemplateGallery /> : view === "mine" ? <SongMyBoards /> : <SongCreateBoard />}
  </div>;
}

function SongMyBoards() {
  const [boards, setBoards] = useState<SongBoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [login, setLogin] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    songRequest<{ boards: SongBoardSummary[] }>("/api/anisong/boards", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setBoards(data.boards); })
      .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "获取曲单失败"); setLogin(cause instanceof SongApiError && cause.status === 401); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const own = boards.filter(item => !item.templateId);
  const participated = boards.filter(item => Boolean(item.templateId));
  function cards(items: typeof boards) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item => {
      return <SongPlaylistCard key={item.id} title={item.title} href={`/anisong/${item.id}`}
        covers={item.covers} count={item.trackCount} playable={item.playableCount}
        progress={item.progress} tag={item.templateId ? "个人参与" : "我创建的"}>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/anisong/${item.id}`} className={appButtonClasses({ variant: "ghost", size: "sm", className: "w-full px-2" })}>曲单详情</Link>
          <Link href={item.canStart ? `/anisong/${item.id}/match` : `/anisong/${item.id}`}
            className={appButtonClasses({ variant: item.canStart ? "primary" : "secondary", size: "sm", className: "w-full px-2" })}>
            {item.canStart ? item.progress ? "继续对决" : "开始对决" : "完善参赛歌曲"}
          </Link>
        </div>
      </SongPlaylistCard>;
    })}</div>;
  }
  return <div className="space-y-8">
    {error && <div role="alert" className="rounded-xl border border-amber-300/20 p-4 text-sm text-amber-100">{error}{login && <> · <Link href="/login?next=%2Fanisong%2Fmine" className="underline">登录后查看我的曲单</Link></>}</div>}
    {loading ? <p role="status" className="py-8 text-sm text-slate-400">正在加载我的音乐曲单…</p> : error ? null : !boards.length ? <div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm text-slate-300">你还没有音乐曲单。<Link href="/anisong/create" className="ml-2 text-anime-cyan underline">创建第一份曲单 →</Link></div> : <>
      <section className="space-y-4" aria-label="我创建的曲单"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">我创建的曲单</h2><span className="text-xs text-slate-400">{own.length} 份</span></div>
        {own.length ? cards(own) : <p className="text-sm text-slate-400">暂无自己创建的曲单。</p>}</section>
      {participated.length > 0 && <section className="space-y-4" aria-label="我参加的公共曲单"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">我参加的公共曲单</h2><span className="text-xs text-slate-400">{participated.length} 份</span></div>{cards(participated)}</section>}
    </>}
  </div>;
}

function SongCreateBoard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true), [error, setError] = useState("");
  const lock = useRef(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const board = await songRequest<SongBoardView>("/api/anisong/boards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, isPublic })
      });
      router.push(`/anisong/${board.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建曲单失败"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="mx-auto max-w-2xl">
    <form onSubmit={create} className="space-y-5 rounded-2xl border border-anime-border bg-anime-panel p-5 sm:p-8">
      <div><h2 className="text-xl font-bold">创建自己的音乐曲单</h2><p className="mt-2 text-sm leading-6 text-slate-400">例如「2026 年度 OP/ED」「秋季新番音乐」。创建后会进入歌曲管理页添加歌曲。</p></div>
      <label className="block text-sm font-medium">曲单名称<input required autoFocus maxLength={80} className="anime-field mt-2" value={title} onChange={event => setTitle(event.target.value)} placeholder="2026 年度动画歌曲" /></label>
      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-300" />
        <span className="text-sm font-semibold">创建后公开展示曲单<span className="mt-1 block text-xs font-normal leading-5 text-slate-400">默认公开，其他人可通过网址查看歌曲信息。不会自动共享你上传的音频；创建后也可以改成私人曲单。</span></span>
      </label>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <div className="flex flex-wrap gap-3"><AppButton variant="primary" type="submit" disabled={busy}>{busy ? "正在创建…" : "创建曲单"}</AppButton><Link href="/anisong" className={appButtonClasses({ variant: "ghost" })}>取消</Link></div>
    </form>
  </section>;
}
