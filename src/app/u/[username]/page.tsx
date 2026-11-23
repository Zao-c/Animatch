"use client";

/* eslint-disable @next/next/no-img-element -- Covers live on COS/CDN hosts that the
   Next image optimizer is not configured for; the rest of AniMatch renders them the
   same way (see AnimeCover and SongCover) with an explicit error fallback. */

import { DashboardTabs } from "@/components/ui/DashboardTabs";
import { CollectionPager } from "@/components/ui/CollectionPager";
import { TasteDashboard } from "@/components/TasteDashboard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { copyTextWithFallback } from "@/lib/browser-copy";
import { proxyExternalImageUrl } from "@/lib/image-proxy";
import { decodeProfileUsername, profilePath } from "@/lib/profile-username";
import { profileCollectionUrl, profilePageCount } from "@/lib/user-profile";

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
      <div className="h-10 max-w-xl rounded-xl bg-white/5" />
    </div>
  );
}


function ProfileMediaCard({ href, title, covers, meta, description, music }: {
  href: string; title: string; covers: string[]; meta: string; description?: string; music?: boolean;
}) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const uniqueCovers = [...new Set(covers.filter(Boolean))].slice(0, 5);
  return <Link href={href} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-anime-border bg-anime-panel transition hover:border-anime-cyan/40 hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-anime-cyan">
    <div className="flex h-28 items-center justify-center gap-1.5 overflow-hidden border-b border-white/10 bg-slate-950/30 p-2.5 sm:h-32">
      {uniqueCovers.length ? uniqueCovers.map(url =>
        <div key={url} className={"relative h-full overflow-hidden rounded-md bg-gradient-to-br from-cyan-950/80 to-violet-950/50 " + (music ? "aspect-square" : "aspect-[3/4]") + (uniqueCovers.length === 1 ? "" : " min-w-0 flex-1")}>
          {!failed[url] ? <img src={proxyExternalImageUrl(url) ?? url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
            onError={() => setFailed(previous => previous[url] ? previous : { ...previous, [url]: true })}
            className="absolute inset-0 h-full w-full object-cover" /> :
            <span aria-hidden="true" className="flex h-full items-center justify-center text-xl text-slate-500">{music ? "♪" : "◇"}</span>}
        </div>
      ) : <span aria-hidden="true" className="text-2xl text-slate-500">{music ? "♪" : "◇"}</span>}
    </div>
    <div className="flex flex-1 flex-col gap-2 p-4">
      <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-cyan-100">{title}</h3>
      {description && <p className="line-clamp-2 text-xs text-slate-400">{description}</p>}
      <p className="mt-auto pt-1 text-xs text-slate-400">{meta}</p>
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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const copyInput = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollOnNextContent = useRef(false);

  useEffect(() => {
    setProfile(null); setContentTab("pools"); setContentPage(1);
    setCopyStatus(""); setManualUrl(""); setAvatarFailed(false);
  }, [username]);
  useEffect(() => {
    if (contentTab === "taste") return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetch(profileCollectionUrl(username, contentTab, contentPage), { signal: controller.signal })
      .then(response => {
        if (response.status === 404) throw new Error("USER_NOT_FOUND");
        if (!response.ok) throw new Error("LOAD_FAILED");
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) { setProfile(data.data ?? null); setLoading(false); } })
      .catch((cause: Error) => { if (!controller.signal.aborted) { setError(cause.message === "USER_NOT_FOUND" ? "USER_NOT_FOUND" : "LOAD_FAILED"); setLoading(false); } });
    return () => controller.abort();
  }, [username, contentTab, contentPage, retry]);
  // Scroll once the new page is on screen: a smooth scroll started before the
  // list re-renders is cancelled by that layout change in Chromium.
  useEffect(() => {
    if (loading || !scrollOnNextContent.current) return;
    scrollOnNextContent.current = false;
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);
  // A collection can shrink while it is open (a snapshot is revoked, a pool turns
  // private). Land on the last real page instead of an empty page N of fewer.
  useEffect(() => {
    const pagination = profile?.pagination;
    if (!pagination || contentTab === "taste") return;
    const lastPage = profilePageCount(pagination.total, pagination.pageSize);
    if (contentPage > lastPage) setContentPage(lastPage);
  }, [profile?.pagination, contentPage, contentTab]);

  async function copyProfileLink() {
    const url = new URL(profilePath(username), window.location.origin).href;
    if (await copyTextWithFallback(url) === "copied") { setCopyStatus("主页网址已复制"); setManualUrl(""); }
    else { setCopyStatus("复制受限，请手动复制下面的网址"); setManualUrl(url);
      window.requestAnimationFrame(() => { copyInput.current?.focus(); copyInput.current?.select(); }); }
  }

  const displayName = useMemo(
    () => profile?.user?.name ?? profile?.user?.username ?? "未知用户",
    [profile]
  );
  const joinedDate = useMemo(() => {
    if (!profile?.user?.createdAt) return "";
    const date = new Date(profile.user.createdAt);
    return Number.isNaN(date.getTime()) ? "" : `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月加入`;
  }, [profile]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-12">
        {loading && !profile ? (
          <ProfileSkeleton />
        ) : error === "USER_NOT_FOUND" ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/72 p-10 text-center shadow-[0_28px_100px_rgba(0,0,0,0.35)]">
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
            <h1 className="mt-5 text-2xl font-black">加载失败</h1>
            <p className="mt-3 text-sm text-slate-400">无法获取用户信息，请稍后再试。</p>
            <AppButton className="mt-4" onClick={() => setRetry(value => value + 1)}>重新加载</AppButton>
          </div>
        ) : profile !== null ? (
          <>
            <section className="rounded-2xl border border-anime-border bg-anime-panel p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-cyan-900/70 to-violet-900/60 text-2xl font-black text-cyan-100">
                    {profile.user.image && !avatarFailed
                      ? <img src={proxyExternalImageUrl(profile.user.image) ?? profile.user.image} alt={displayName + "头像"} decoding="async" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" />
                      : <span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-black text-white">
                      {displayName}
                    </h1>
                    {profile.user.username ? (
                      <p className="mt-1 break-all text-sm text-slate-400">
                        @{profile.user.username}
                      </p>
                    ) : null}
                    {(joinedDate || profile.stats.participatedPoolCount > 0) && <p className="mt-2 text-xs text-slate-400">{joinedDate}{joinedDate && profile.stats.participatedPoolCount > 0 ? " · " : ""}{profile.stats.participatedPoolCount > 0 ? `参与 ${profile.stats.participatedPoolCount} 个番组` : ""}</p>}
                  </div>
                </div>
                <div className="flex min-w-0 shrink-0 flex-col items-start gap-2 sm:items-end">
                  <AppButton size="sm" variant="secondary" onClick={() => void copyProfileLink()}>分享主页</AppButton>
                  {copyStatus && <span role="status" className="text-xs text-cyan-100">{copyStatus}</span>}
                  {manualUrl && <input ref={copyInput} value={manualUrl} aria-label="手动复制主页网址" readOnly onFocus={event => event.currentTarget.select()} className="anime-field w-full max-w-[22rem] text-xs" />}
                </div>
              </div>
            </section>


            <section ref={contentRef} aria-label="公开作品和口味档案" className="scroll-mt-28 space-y-4">
              <h2 className="sr-only">公开作品</h2>
              <DashboardTabs id="profile-library" label="公开内容" mobileScroll value={contentTab} onChange={(tab) => { setContentTab(tab); setContentPage(1); }} items={[
                { value: "pools", label: "番组", count: profile.stats.publicPoolsCount },
                { value: "shares", label: "动画榜单", count: profile.stats.sharedTierListCount },
                { value: "songs", label: "音乐曲单", count: profile.stats.publicSongPlaylistsCount },
                { value: "songTiers", label: "音乐榜单", count: profile.stats.sharedSongTierListCount },
                { value: "taste", label: "口味" }
              ]} />
              {contentTab === "taste" ? <div role="tabpanel" id="profile-library-panel-taste" aria-labelledby="profile-library-tab-taste"><TasteDashboard username={username} /></div> :
                <div role="tabpanel" id={"profile-library-panel-" + contentTab} aria-labelledby={"profile-library-tab-" + contentTab} className="space-y-4">
                  {error ? <div role="alert" className="rounded-xl border border-amber-300/20 p-4 text-sm text-amber-200">公开内容加载失败。<AppButton className="ml-3" size="sm" onClick={() => setRetry(value => value + 1)}>重试</AppButton></div> :
                    loading ? <div role="status" className="py-8 text-sm text-slate-400">正在加载公开作品…</div> : <>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {contentTab === "pools" && profile.publicPools.map(pool => <ProfileMediaCard key={pool.id}
                          href={"/pools/" + pool.id} title={pool.name} covers={pool.coverUrls}
                          meta={pool.animeCount + " 部动画 · " + pool.tierListCount + " 份个人对决"} description={pool.description ?? undefined} />)}
                        {contentTab === "shares" && profile.publicTierLists.map(tl => <ProfileMediaCard key={tl.token}
                          href={"/share/tier/" + tl.token} title={tl.title} covers={tl.coverUrls}
                          meta={tl.animeCount + " 部作品 · " + tl.comparisonCount + " 场对决"} description={tl.poolName} />)}
                        {contentTab === "songs" && profile.publicSongPlaylists.map(song => <ProfileMediaCard key={song.id}
                          href={"/anisong/templates/" + song.id} title={song.title} covers={song.coverUrls} music
                          meta={song.trackCount + " 首歌曲"} />)}
                        {contentTab === "songTiers" && profile.publicSongTierLists.map(song => <ProfileMediaCard key={song.token}
                          href={"/anisong/share/" + song.token} title={song.title} covers={song.coverUrls} music
                          meta={song.trackCount + " 首歌曲 · " + song.comparisonCount + " 场对决"} />)}
                      </div>
                      {(contentTab === "pools" ? profile.stats.publicPoolsCount : contentTab === "shares" ? profile.stats.sharedTierListCount : contentTab === "songs" ? profile.stats.publicSongPlaylistsCount : profile.stats.sharedSongTierListCount) === 0 &&
                        <div className="rounded-xl border border-dashed border-white/15 bg-anime-panel p-8 text-center text-sm text-slate-400">
                          {contentTab === "pools" ? "还没有创建公开番组" : contentTab === "shares" ? "还没有公开榜单" : contentTab === "songs" ? "还没有公开音乐曲单" : "还没有分享音乐 Tier List"}
                        </div>}
                      <CollectionPager label="公开内容" page={contentPage} pageSize={profile.pagination.pageSize} total={
                        contentTab === "pools" ? profile.stats.publicPoolsCount :
                        contentTab === "shares" ? profile.stats.sharedTierListCount :
                        contentTab === "songs" ? profile.stats.publicSongPlaylistsCount : profile.stats.sharedSongTierListCount
                      } onChange={(next) => { scrollOnNextContent.current = true; setContentPage(next); }} />
                    </>}
                </div>}
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
