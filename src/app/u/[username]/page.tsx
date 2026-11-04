"use client";

import { DashboardTabs } from "@/components/ui/DashboardTabs";
import { CollectionPager } from "@/components/ui/CollectionPager";
import { TasteDashboard } from "@/components/TasteDashboard";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { PageShell } from "@/components/PageShell";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { copyTextWithFallback } from "@/lib/browser-copy";
import { proxyExternalImageUrl } from "@/lib/image-proxy";
import { formatDateTimeStable } from "@/lib/date-format";
import { decodeProfileUsername } from "@/lib/profile-username";

type PublicTab = "pools" | "shares" | "songs" | "songTiers" | "taste";
interface PublicProfile {
  user: {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
    createdAt: string;
  };
  stats: {
    publicPoolsCount: number;
    sharedTierListCount: number;
    participatedPoolCount: number;
    publicSongPlaylistsCount: number;
    sharedSongTierListCount: number;
  };
  publicPools: PublicPoolEntry[];
  publicTierLists: PublicTierListEntry[];
  publicSongPlaylists: { id: string; title: string; trackCount: number; coverUrls: string[]; updatedAt: string }[];
  publicSongTierLists: { token: string; title: string; trackCount: number; comparisonCount: number; coverUrls: string[]; updatedAt: string }[];
  pagination: { section: string; page: number; pageSize: number; total: number };
}

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

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="h-3 w-24 rounded bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}


function ProfileMediaCard({ href, title, covers, category, meta, description, music, date }: {
  href: string; title: string; covers: string[]; category: string; meta: string; description?: string; music?: boolean; date?: string;
}) {
  return <Link href={href} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-anime-border bg-anime-panel transition hover:border-anime-cyan/40 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-anime-cyan">
    <div className="grid grid-cols-5 gap-1.5 border-b border-white/10 bg-slate-950/30 p-2.5">
      {Array.from({ length: 5 }, (_, index) => covers[index] ?? "").map((url, index) =>
        <div key={index} className={"relative min-w-0 overflow-hidden rounded-md bg-gradient-to-br from-cyan-950/80 to-violet-950/50 " + (music ? "aspect-square" : "aspect-[3/4]")}>
          {url ? <Image src={proxyExternalImageUrl(url) ?? url} alt={title + "封面 " + (index + 1)} fill sizes="(max-width: 640px) 18vw, 7vw" className="object-cover" loading="lazy" /> :
            <span aria-hidden="true" className="flex h-full items-center justify-center text-xl text-slate-500">{music ? "♪" : "◇"}</span>}
        </div>)}
    </div>
    <div className="flex flex-1 flex-col gap-2 p-4">
      <div><AppBadge tone="muted">{category}</AppBadge></div>
      <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-cyan-100">{title}</h3>
      {description && <p className="line-clamp-2 text-xs text-slate-400">{description}</p>}
      <div className="mt-auto space-y-1 pt-2"><p className="text-xs text-slate-300">{meta}</p>
        {date && <p className="text-[11px] text-slate-500">更新于 {date.slice(0, 10)}</p>}
      </div>
    </div>
  </Link>;
}

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeProfileUsername(params.username);

  const [contentTab, setContentTab] = useState<PublicTab>("pools");
  const [contentPage, setContentPage] = useState(1);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const copyInput = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfile(null); setContentTab("pools"); setContentPage(1);
  }, [username]);
  useEffect(() => {
    if (contentTab === "taste") return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetch("/api/users/" + encodeURIComponent(username) + "/public-profile?section=" + contentTab + "&page=" + contentPage, { signal: controller.signal })
      .then(response => {
        if (response.status === 404) throw new Error("USER_NOT_FOUND");
        if (!response.ok) throw new Error("LOAD_FAILED");
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) { setProfile(data.data ?? null); setLoading(false); } })
      .catch((cause: Error) => { if (!controller.signal.aborted) { setError(cause.message === "USER_NOT_FOUND" ? "USER_NOT_FOUND" : "LOAD_FAILED"); setLoading(false); } });
    return () => controller.abort();
  }, [username, contentTab, contentPage, retry]);

  async function copyProfileLink() {
    const url = new URL("/u/" + encodeURIComponent(username), window.location.origin).href;
    if (await copyTextWithFallback(url) === "copied") { setCopyStatus("主页网址已复制"); setManualUrl(""); }
    else { setCopyStatus("复制失败，请手动复制下面的网址"); setManualUrl(url);
      window.requestAnimationFrame(() => { copyInput.current?.focus(); copyInput.current?.select(); }); }
  }

  const displayName = useMemo(
    () => profile?.user?.name ?? profile?.user?.username ?? "未知用户",
    [profile]
  );
  const joinedDate = useMemo(() => {
    if (!profile?.user?.createdAt) return "";
    try {
      return formatDateTimeStable(new Date(profile.user.createdAt));
    } catch {
      return "";
    }
  }, [profile]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-12">
        {loading && !profile ? (
          <ProfileSkeleton />
        ) : error === "USER_NOT_FOUND" ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/72 p-10 text-center shadow-[0_28px_100px_rgba(0,0,0,0.35)]">
            <AppBadge tone="tier">AniMatch</AppBadge>
            <h1 className="mt-5 text-2xl font-black">用户不存在</h1>
            <p className="mt-3 text-sm text-slate-400">
              这位用户可能已注销，或你输入的地址有误。
            </p>
            <Link
              href="/pools"
              className={`${appButtonClasses({ variant: "primary" })} mt-6`}
            >
              浏览公开番组
            </Link>
          </div>
        ) : error !== null && !profile ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/72 p-10 text-center shadow-[0_28px_100px_rgba(0,0,0,0.35)]">
            <AppBadge tone="tier">AniMatch</AppBadge>
            <h1 className="mt-5 text-2xl font-black">加载失败</h1>
            <p className="mt-3 text-sm text-slate-400">无法获取用户信息，请稍后再试。</p>
            <AppButton className="mt-4" onClick={() => setRetry(value => value + 1)}>重新加载</AppButton>
          </div>
        ) : profile !== null ? (
          <>
            <section className="rounded-2xl border border-anime-border bg-anime-panel p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center sm:gap-6">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-900/70 to-violet-900/60 text-2xl font-black text-cyan-100">
                  {profile.user.image ? <Image src={proxyExternalImageUrl(profile.user.image) ?? profile.user.image} alt={displayName + "头像"} fill sizes="80px" className="object-cover" /> : displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black text-white">
                    {displayName}
                  </h1>
                  {profile.user.username ? (
                    <p className="mt-1 text-sm text-slate-400">
                      @{profile.user.username}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AppBadge tone="tier">AniMatch 玩家</AppBadge>
                    {joinedDate ? (
                      <AppBadge tone="muted">加入于 {joinedDate}</AppBadge>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>


            <section aria-label="个人公开作品统计" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {([
                ["公开番组", profile.stats.publicPoolsCount, "pools"],
                ["公开榜单", profile.stats.sharedTierListCount, "shares"],
                ["音乐曲单", profile.stats.publicSongPlaylistsCount, "songs"],
                ["音乐榜单", profile.stats.sharedSongTierListCount, "songTiers"],
                ["参与番组", profile.stats.participatedPoolCount, null]
              ] as const).map(([label, count, target]) => <button key={label} type="button" disabled={!target}
                onClick={() => { if (target) { setContentTab(target); setContentPage(1); contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}
                className="min-h-24 rounded-xl border border-anime-border bg-anime-panel p-4 text-left transition enabled:hover:border-anime-cyan/40 disabled:cursor-default">
                <span className="block text-2xl font-black tabular-nums text-white">{count}</span>
                <span className="mt-1 block text-xs text-slate-400">{label}</span>
              </button>)}
            </section>

            <section ref={contentRef} aria-label="公开作品和口味档案" className="scroll-mt-28 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-bold">公开作品</h2><p className="mt-1 text-xs text-slate-400">所有公开的番组、动画榜单和音乐作品集中展示，口味档案可以单独查看。</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <AppButton size="sm" variant="ghost" onClick={() => void copyProfileLink()}>分享主页</AppButton>
                  {copyStatus && <span role="status" className="text-xs text-cyan-100">{copyStatus}</span>}
                  {manualUrl && <input ref={copyInput} value={manualUrl} aria-label="手动复制主页网址" readOnly onFocus={event => event.currentTarget.select()} className="anime-field max-w-full text-xs" />}
                </div>
              </div>
              <DashboardTabs id="profile-library" label="公开内容" value={contentTab} onChange={(tab) => { setContentTab(tab); setContentPage(1); }} items={[
                { value: "pools", label: "公开番组", count: profile.stats.publicPoolsCount },
                { value: "shares", label: "动画 Tier", count: profile.stats.sharedTierListCount },
                { value: "songs", label: "音乐曲单", count: profile.stats.publicSongPlaylistsCount },
                { value: "songTiers", label: "音乐 Tier", count: profile.stats.sharedSongTierListCount },
                { value: "taste", label: "口味档案" }
              ]} />
              {contentTab === "taste" ? <div role="tabpanel" id="profile-library-panel-taste" aria-labelledby="profile-library-tab-taste"><TasteDashboard username={username} /></div> :
                <div role="tabpanel" id={"profile-library-panel-" + contentTab} aria-labelledby={"profile-library-tab-" + contentTab} className="space-y-4">
                  {error ? <div role="alert" className="rounded-xl border border-amber-300/20 p-4 text-sm text-amber-200">公开内容加载失败。<AppButton className="ml-3" size="sm" onClick={() => setRetry(value => value + 1)}>重试</AppButton></div> :
                    loading ? <div role="status" className="py-8 text-sm text-slate-400">正在加载公开作品…</div> : <>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {contentTab === "pools" && profile.publicPools.map(pool => <ProfileMediaCard key={pool.id}
                          href={"/pools/" + pool.id} title={pool.name} covers={pool.coverUrls} category="公开番组"
                          meta={pool.animeCount + " 部动画 · " + pool.tierListCount + " 份个人对决"} description={pool.description ?? "暂无描述"} date={pool.updatedAt} />)}
                        {contentTab === "shares" && profile.publicTierLists.map(tl => <ProfileMediaCard key={tl.token}
                          href={"/share/tier/" + tl.token} title={tl.title} covers={tl.coverUrls} category="动画 Tier List"
                          meta={tl.animeCount + " 部作品 · " + tl.comparisonCount + " 场对决"} description={tl.poolName} date={tl.createdAt} />)}
                        {contentTab === "songs" && profile.publicSongPlaylists.map(song => <ProfileMediaCard key={song.id}
                          href={"/anisong/templates/" + song.id} title={song.title} covers={song.coverUrls} music category="公开音乐曲单"
                          meta={song.trackCount + " 首歌曲"} date={song.updatedAt} />)}
                        {contentTab === "songTiers" && profile.publicSongTierLists.map(song => <ProfileMediaCard key={song.token}
                          href={"/anisong/share/" + song.token} title={song.title} covers={song.coverUrls} music category="音乐 Tier List"
                          meta={song.trackCount + " 首歌曲 · " + song.comparisonCount + " 场对决"} date={song.updatedAt} />)}
                      </div>
                      {(contentTab === "pools" ? profile.stats.publicPoolsCount : contentTab === "shares" ? profile.stats.sharedTierListCount : contentTab === "songs" ? profile.stats.publicSongPlaylistsCount : profile.stats.sharedSongTierListCount) === 0 &&
                        <div className="rounded-xl border border-dashed border-white/15 bg-anime-panel p-8 text-center text-sm text-slate-400">
                          {contentTab === "pools" ? "还没有创建公开番组" : contentTab === "shares" ? "还没有公开榜单" : contentTab === "songs" ? "还没有公开音乐曲单" : "还没有分享音乐 Tier List"}
                        </div>}
                      <CollectionPager label="公开内容" page={contentPage} pageSize={profile.pagination.pageSize} total={
                        contentTab === "pools" ? profile.stats.publicPoolsCount :
                        contentTab === "shares" ? profile.stats.sharedTierListCount :
                        contentTab === "songs" ? profile.stats.publicSongPlaylistsCount : profile.stats.sharedSongTierListCount
                      } onChange={(next) => { setContentPage(next); window.requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
                    </>}
                </div>}
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
