"use client";
import Link from "next/link";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import type { SongBoardView } from "@/lib/anisong/types";
import { SongPlaylistCard } from "./SongPlaylistCard";
import { rankSongs } from "@/lib/anisong/engine";
import { SongTemplateGallery } from "./SongTemplateGallery";

export function SongLobby() {
  const router = useRouter();
  const [boards, setBoards] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  const [title, setTitle] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    songRequest<{ boards: typeof boards }>("/api/anisong/boards")
      .then(data => { if (alive) setBoards(data.boards); })
      .catch(e => { if (alive) { setError(e.message); setLogin(e instanceof SongApiError && e.status === 401); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const [details, setDetails] = useState<Record<string, SongBoardView>>({});
  useEffect(() => {
    const controller = new AbortController(); let index = 0;
    async function worker() { while (!controller.signal.aborted && index < boards.length) {
      const board = boards[index++];
      try { const value = await songRequest<SongBoardView>(`/api/anisong/boards/${board.id}`, { signal: controller.signal }); if (!controller.signal.aborted) setDetails(previous => ({ ...previous, [board.id]: value })); } catch { /* The card remains navigable when details are unavailable. */ }
    } }
    void Promise.all([worker(), worker(), worker()]); return () => controller.abort();
  }, [boards]);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const board = await songRequest<SongBoardView>("/api/anisong/boards", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title })
      });
      router.push(`/anisong/${board.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "创建失败"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-[90rem] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">音乐对决</h1><p className="mt-3 text-sm leading-6 text-slate-400">选择曲单，试听 OP、ED 和插入曲，用对决生成你的音乐 Tier List。</p></div>
      <p className="text-xs text-slate-400">{boards.length} 份我的曲单 · 每个人独立保存排名</p>
    </header>
    <SongTemplateGallery />
    {error && <div role="alert" className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-amber-100">{error} {login && <Link className="underline" href="/login?next=%2Fanisong">去登录</Link>}</div>}
    {!login && <section className="grid gap-8 lg:grid-cols-[1fr_1.25fr]">
      <form onSubmit={create} className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/30 p-6">
        <h2 className="text-xl font-semibold">创建自己的音乐曲单</h2>
        <p className="text-sm leading-6 text-slate-400">例如「2026 秋季 OP」「摇滚 ED 精选」。先创建曲单，再添加歌曲、选择参赛范围，就能开始对决。</p>
        <label className="block text-sm">曲单名称<input required maxLength={80} className="anime-field mt-2" placeholder="2026 秋季 OP / ED" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <AppButton type="submit" disabled={busy || loading}>{busy ? "正在创建…" : "创建曲单"}</AppButton>
        <p className="text-xs leading-5 text-slate-500">新曲单默认仅自己可见。公共发布位于曲单设置中，个人 Tier List 分享是独立操作。</p>
      </form>
      <div>
        <h2 className="mb-4 text-xl font-semibold">我的音乐曲单</h2>
        {loading ? <p role="status" className="text-slate-400">正在加载曲单…</p> : boards.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-8 text-slate-400">第一份音乐榜单，从你喜欢的两首歌开始。</div> : <div className="grid gap-4 sm:grid-cols-2">
          {boards.map(board => { const value = details[board.id]; const tracks = value?.document.tracks; return <SongPlaylistCard key={board.id} title={board.title} href={`/anisong/${board.id}`} covers={tracks?.map(t => t.coverUrl) ?? []} count={tracks?.length} playable={tracks?.filter(t => t.source.kind !== "none" || t.itunes).length} progress={value ? rankSongs(value.document).progress.effectiveComparisons : undefined}>
            <Link className={appButtonClasses({ variant: "primary", className: "w-full" })} href={`/anisong/${board.id}/match`}>继续对决</Link><Link className="inline-flex min-h-9 items-center text-xs text-slate-400 hover:text-white" href={`/anisong/${board.id}`}>管理歌曲与参赛范围 →</Link>
          </SongPlaylistCard>; })}
        </div>}
      </div>
    </section>}
    <Link href="/pools?view=public" className={appButtonClasses({ variant: "ghost" })}>返回动画番组</Link>
  </div>;
}
