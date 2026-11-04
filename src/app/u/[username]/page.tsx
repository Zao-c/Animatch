"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CollectionPager } from "@/components/ui/CollectionPager";
import { DashboardTabs } from "@/components/ui/DashboardTabs";
import { TasteDashboard } from "@/components/TasteDashboard";
import { ProfileTastePreview } from "@/components/ProfileTastePreview";
import { PageShell } from "@/components/PageShell";
import { appButtonClasses } from "@/components/ui/AppButton";
import { proxyExternalImageUrl } from "@/lib/image-proxy";
import { decodeProfileUsername } from "@/lib/profile-username";

interface PublicPoolEntry {
  id: string;
  name: string;
  description: string | null;
  animeCount: number;
  tierListCount: number;
  coverUrls: string[];
  createdAt: string;
  updatedAt: string;
}
interface PublicTierListEntry {
  token: string;
  title: string;
  poolName: string;
  animeCount: number;
  comparisonCount: number;
  coverUrls: string[];
  createdAt: string;
}
interface PublicSongPlaylistEntry {
  id: string;
  title: string;
  trackCount: number;
  coverUrls: string[];
  updatedAt: string;
}
interface PublicProfile {
  user: { id: string; username: string | null; name: string | null; image: string | null; createdAt: string };
  stats: { publicPoolsCount: number; sharedTierListCount: number; participatedPoolCount: number; publicSongPlaylistsCount: number };
  publicPools: PublicPoolEntry[];
  publicTierLists: PublicTierListEntry[];
  publicSongPlaylists: PublicSongPlaylistEntry[];
}

type Section = "shares" | "pools" | "songs" | "taste";
type Group<T> = { key: string; latest: T; entries: T[] };

function groupByLabel<T>(items: T[], keyFor: (item: T) => string): Group<T>[] {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const existing = grouped.get(key);
    if (existing) existing.push(item);
    else grouped.set(key, [item]);
  }
  return [...grouped].map(([key, entries]) => ({ key, latest: entries[0], entries }));
}

function CoverStrip({ urls, title }: { urls: string[]; title: string }) {
  const unique = [...new Set(urls.filter(Boolean))].slice(0, 5);
  return <div className="flex h-28 items-center justify-center gap-1 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-violet-950/30 p-2 sm:h-32">
    {unique.length ? unique.map((url) => <div key={url} className={"relative h-full min-w-0 overflow-hidden rounded-md " + (unique.length === 1 ? "w-24" : "flex-1")}>
      <Image src={proxyExternalImageUrl(url) ?? url} alt="" fill sizes="(max-width: 640px) 25vw, 140px" className="object-cover" loading="lazy" />
    </div>) : <span className="text-3xl font-light text-cyan-200/40" aria-label={title + "暂无封面"}>✦</span>}
  </div>;
}

function ProfileSkeleton() {
  return <div role="status" aria-label="正在加载个人主页" className="animate-pulse space-y-6">
    <div className="flex items-center gap-5 rounded-3xl border border-white/10 p-6">
      <div className="h-20 w-20 rounded-2xl bg-white/10"/>
      <div className="flex-1 space-y-3"><div className="h-6 w-32 rounded bg-white/10"/><div className="h-3 w-48 rounded bg-white/5"/></div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0,1,2,3].map(n => <div key={n} className="h-20 rounded-xl bg-white/5"/>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="h-60 rounded-2xl bg-white/5"/><div className="h-60 rounded-2xl bg-white/5"/></div>
  </div>;
}

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeProfileUsername(params.username);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"USER_NOT_FOUND" | "LOAD_FAILED" | null>(null);
  const [section, setSection] = useState<Section>("shares");
  const [page, setPage] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setProfile(null); setSection("shares"); setPage(1);
    fetch("/api/users/" + encodeURIComponent(username) + "/public-profile", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? "USER_NOT_FOUND" : "LOAD_FAILED");
        return response.json();
      })
      .then(result => { if (!controller.signal.aborted) setProfile(result.data ?? null); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error && cause.message === "USER_NOT_FOUND" ? "USER_NOT_FOUND" : "LOAD_FAILED");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [username, reload]);

  const shareGroups = useMemo(() => groupByLabel(profile?.publicTierLists ?? [], item => item.poolName + "\u001f" + item.title), [profile]);
  const poolGroups = useMemo(() => groupByLabel(profile?.publicPools ?? [], item => item.name), [profile]);
  const songGroups = useMemo(() => groupByLabel(profile?.publicSongPlaylists ?? [], item => item.title), [profile]);
  const displayName = profile?.user.name?.trim() || profile?.user.username || "未知用户";
  const joined = useMemo(() => {
    if (!profile?.user.createdAt) return "";
    const date = new Date(profile.user.createdAt);
    return Number.isNaN(date.getTime()) ? "" : date.getUTCFullYear() + " 年 " + (date.getUTCMonth() + 1) + " 月加入";
  }, [profile]);
  const groups = section === "shares" ? shareGroups : section === "pools" ? poolGroups : songGroups;
  const pageSize = 6;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(groups.length / pageSize)));
  const visibleShareGroups = shareGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visiblePoolGroups = poolGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleSongGroups = songGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function switchSection(next: Section, scroll = false) {
    setSection(next); setPage(1);
    if (scroll) window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <PageShell><div className="mx-auto w-full max-w-6xl space-y-6 pb-14 sm:space-y-8">
    {loading ? <ProfileSkeleton /> : error || !profile ?
      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-center sm:p-12">
        <h1 className="text-2xl font-bold">{error === "USER_NOT_FOUND" ? "用户不存在" : "加载失败"}</h1>
        <p className="mt-2 text-sm text-slate-400">{error === "USER_NOT_FOUND" ? "该用户不存在或已注销。" : "暂时无法获取个人主页。"}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/pools?view=public" className={appButtonClasses({ variant: "secondary" })}>返回番组大厅</Link>
          {error !== "USER_NOT_FOUND" && <button className={appButtonClasses({ variant: "primary" })} type="button" onClick={() => setReload(n => n + 1)}>重试</button>}
        </div>
      </div> : <>
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-[#111c37] to-[#102b38] p-5 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"/>
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-3xl font-black text-white sm:h-24 sm:w-24">
            {profile.user.image ? <Image src={proxyExternalImageUrl(profile.user.image) ?? profile.user.image} fill sizes="96px" alt={displayName + "的头像"} className="object-cover"/> : displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-[0.16em] text-cyan-200/75">ANIMATCH PLAYER</p>
            <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-white sm:text-4xl">{displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
              {profile.user.username && <span>@{profile.user.username}</span>}
              {joined && <span className="text-slate-400">{joined}</span>}
            </div>
          </div>
          <button type="button" onClick={() => switchSection("shares", true)}
            className="relative mt-4 inline-flex min-h-10 items-center rounded-xl border border-cyan-300/30 bg-cyan-300/[0.07] px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/55 hover:bg-cyan-300/15 sm:absolute sm:right-8 sm:top-8 sm:mt-0">
            查看榜单
          </button>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {([
            [profile.stats.sharedTierListCount,"公开榜单"],
            [profile.stats.publicPoolsCount,"公开番组"],
            [profile.stats.participatedPoolCount,"参与番组"],
            [profile.stats.publicSongPlaylistsCount,"音乐曲单"]
          ] as const).map(([value, label]) => <div key={label} className="rounded-xl border border-white/10 bg-slate-950/25 p-3 sm:p-4">
            <p className="text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</p>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">{label}</p>
          </div>)}
        </div>
      </header>

      <div ref={panelRef} className="scroll-mt-24">
        <DashboardTabs id="profile-library" label="个人主页内容" value={section} onChange={tab => switchSection(tab)}
          items={[
            { value: "shares", label: "公开榜单", count: profile.stats.sharedTierListCount },
            { value: "pools", label: "公开番组", count: profile.stats.publicPoolsCount },
            { value: "songs", label: "音乐曲单", count: profile.stats.publicSongPlaylistsCount },
            { value: "taste", label: "口味分析" }
          ]}/>
      </div>

      {section === "taste" ? <div role="tabpanel" id="profile-library-panel-taste" aria-labelledby="profile-library-tab-taste">
        <TasteDashboard username={username}/>
      </div> :
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section role="tabpanel" id={"profile-library-panel-" + section} aria-labelledby={"profile-library-tab-" + section} className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-white">{section === "shares" ? "公开榜单" : section === "pools" ? "公开番组" : "音乐曲单"}</h2>
              <span className="text-xs text-slate-400">{groups.length} 组作品</span>
            </div>
            {section === "shares" ? (shareGroups.length ?
              <div className="grid gap-4 sm:grid-cols-2">{visibleShareGroups.map(group => {
                const tl = group.latest;
                return <article key={group.key} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-cyan-300/30">
                  <Link href={"/share/tier/" + tl.token} className="group block">
                    <CoverStrip urls={tl.coverUrls} title={tl.title}/>
                    <h3 className="mt-3 line-clamp-2 text-base font-bold text-white group-hover:text-cyan-200">{tl.title}</h3>
                    <p className="mt-1 truncate text-xs text-slate-400">{tl.poolName} · {tl.animeCount} 部作品</p>
                  </Link>
                  {group.entries.length > 1 ? <details className="mt-3 rounded-lg border border-white/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-cyan-100">还有 {group.entries.length - 1} 份同名榜单</summary>
                    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                      {group.entries.slice(1).map((item, index) =>
                        <Link key={item.token} href={"/share/tier/" + item.token} className="block rounded-md px-2 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white">
                          第 {index + 2} 份 · {item.animeCount} 部作品 · {item.comparisonCount} 场对决
                        </Link>)}
                    </div>
                  </details> : null}
                </article>;
              })}</div> : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">还没有公开榜单</div>
            ) : section === "pools" ? (poolGroups.length ?
              <div className="grid gap-4 sm:grid-cols-2">{visiblePoolGroups.map(group => {
                const pool = group.latest;
                return <article key={group.key} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-violet-300/30">
                  <Link href={"/pools/" + pool.id} className="group block">
                    <CoverStrip urls={pool.coverUrls} title={pool.name}/>
                    <h3 className="mt-3 line-clamp-2 text-base font-bold text-white group-hover:text-violet-200">{pool.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{pool.animeCount} 部作品</p>
                    {pool.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{pool.description}</p>}
                  </Link>
                  {group.entries.length > 1 ? <details className="mt-3 rounded-lg border border-white/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-violet-200">还有 {group.entries.length - 1} 个同名番组</summary>
                    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                      {group.entries.slice(1).map(item => <Link key={item.id} href={"/pools/" + item.id}
                        className="block rounded-md px-2 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white">
                        {item.name} · {item.animeCount} 部作品
                      </Link>)}
                    </div>
                  </details> : null}
                </article>;
              })}</div> : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">还没有创建公开番组</div>
            ) : (songGroups.length ?
              <div className="grid gap-4 sm:grid-cols-2">{visibleSongGroups.map(group => {
                const song = group.latest;
                return <article key={group.key} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-cyan-300/30">
                  <Link href={"/anisong/templates/" + song.id} className="group block">
                    <CoverStrip urls={song.coverUrls} title={song.title}/>
                    <h3 className="mt-3 line-clamp-2 text-base font-bold text-white group-hover:text-cyan-200">{song.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">{song.trackCount} 首歌曲</p>
                  </Link>
                  {group.entries.length > 1 && <details className="mt-3 rounded-lg border border-white/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-cyan-100">还有 {group.entries.length - 1} 份同名曲单</summary>
                    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                      {group.entries.slice(1).map(item => <Link key={item.id} href={"/anisong/templates/" + item.id}
                        className="block rounded-md px-2 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white">
                        {item.title} · {item.trackCount} 首歌曲
                      </Link>)}
                    </div>
                  </details>}
                </article>;
              })}</div> : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">还没有公开音乐曲单</div>
            )}
            {groups.length > pageSize && <CollectionPager
              label="作品" page={currentPage} total={groups.length} pageSize={pageSize}
              onChange={next => { setPage(next); panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}/>}
            {(section === "shares" ? profile.stats.sharedTierListCount > profile.publicTierLists.length : section === "pools" ? profile.stats.publicPoolsCount > profile.publicPools.length : profile.stats.publicSongPlaylistsCount > profile.publicSongPlaylists.length) &&
              <p className="text-xs text-slate-500">这里只展示最近发布的作品。</p>}
          </section>
          <aside className="min-w-0 space-y-4">
            <ProfileTastePreview username={username} onExplore={() => switchSection("taste", true)}/>
          </aside>
        </div>}
    </>}
  </div></PageShell>;
}
