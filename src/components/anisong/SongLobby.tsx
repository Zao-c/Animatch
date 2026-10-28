"use client";
import Link from "next/link";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import type { SongBoardView } from "@/lib/anisong/types";

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
  return <div className="mx-auto max-w-6xl space-y-10">
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 p-6 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full border-[40px] border-anime-cyan/5" />
      <p className="text-sm font-semibold tracking-[0.25em] text-anime-cyan">ANISONGMATCH</p>
      <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">这一季，<br />哪首歌让你舍不得跳过？</h1>
      <p className="mt-5 max-w-xl leading-7 text-slate-300">收集喜欢的 OP、ED 和插入曲。听一段，选一首，<br className="hidden sm:block" />把一次次选择变成你的音乐 Tier List。</p>
      <div className="mt-7 flex flex-wrap gap-2 text-xs text-slate-300">
        {["01  建立曲单", "02  左右试听与对决", "03  生成个人分档"].map(text => <span key={text} className="rounded-full border border-white/10 px-4 py-2">{text}</span>)}
      </div>
    </section>
    {error && <div role="alert" className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-amber-100">{error} {login && <Link className="underline" href="/login?next=%2Fanisong">去登录</Link>}</div>}
    {!login && <section className="grid gap-8 lg:grid-cols-[1fr_1.25fr]">
      <form onSubmit={create} className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/30 p-6">
        <h2 className="text-xl font-semibold">创建音乐曲单</h2>
        <p className="text-sm leading-6 text-slate-400">例如「2026 秋季 OP」「摇滚 ED 精选」。每份曲单最多 64 首，上传音频或填写音频直链即可开赛。</p>
        <label className="block text-sm">曲单名称<input required maxLength={80} className="anime-field mt-2" placeholder="2026 秋季 OP / ED" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <AppButton type="submit" disabled={busy || loading}>{busy ? "正在创建…" : "创建曲单"}</AppButton>
        <p className="text-xs leading-5 text-slate-500">曲单与上传音频默认仅自己可见。发布榜单时只分享歌名、歌手和分档。</p>
      </form>
      <div>
        <h2 className="mb-4 text-xl font-semibold">我的音乐曲单</h2>
        {loading ? <p role="status" className="text-slate-400">正在加载曲单…</p> : boards.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-8 text-slate-400">第一份音乐榜单，从你喜欢的两首歌开始。</div> : <div className="grid gap-3">
          {boards.map(board => <Link key={board.id} href={`/anisong/${board.id}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-5 hover:border-anime-cyan/40">
            <span className="min-w-0"><span className="block break-words font-semibold">{board.title}</span><span className="mt-1 block text-xs text-slate-500">继续编辑与对决</span></span><span className="text-anime-cyan" aria-hidden>↗</span>
          </Link>)}
        </div>}
      </div>
    </section>}
    <Link href="/pools?view=public" className={appButtonClasses({ variant: "ghost" })}>返回动画番组</Link>
  </div>;
}
