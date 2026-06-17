"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { PageShell } from "@/components/PageShell";
import { appButtonClasses } from "@/components/ui/AppButton";
import { proxyExternalImageUrl } from "@/lib/image-proxy";
import { formatDateTimeStable } from "@/lib/date-format";

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
  };
  publicPools: PublicPoolEntry[];
  publicTierLists: PublicTierListEntry[];
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

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/users/${encodeURIComponent(username)}/public-profile`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("USER_NOT_FOUND");
          throw new Error("LOAD_FAILED");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data.data ?? null);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message === "USER_NOT_FOUND" ? "USER_NOT_FOUND" : "LOAD_FAILED");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

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
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
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
        ) : error !== null ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/72 p-10 text-center shadow-[0_28px_100px_rgba(0,0,0,0.35)]">
            <AppBadge tone="tier">AniMatch</AppBadge>
            <h1 className="mt-5 text-2xl font-black">加载失败</h1>
            <p className="mt-3 text-sm text-slate-400">
              无法获取用户信息，请稍后再试。
            </p>
          </div>
        ) : profile !== null ? (
          <>
            <section className="mb-10 rounded-3xl border border-white/10 bg-slate-950/72 p-6 shadow-[0_28px_100px_rgba(0,0,0,0.35)] sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl font-black text-white/40">
                  {displayName.slice(0, 1).toUpperCase()}
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

            <section className="mb-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
                <p className="text-2xl font-black text-white">{profile.stats.publicPoolsCount}</p>
                <p className="mt-1 text-xs text-slate-400">公开番组</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
                <p className="text-2xl font-black text-white">{profile.stats.sharedTierListCount}</p>
                <p className="mt-1 text-xs text-slate-400">公开榜单</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
                <p className="text-2xl font-black text-white">{profile.stats.participatedPoolCount}</p>
                <p className="mt-1 text-xs text-slate-400">参与番组</p>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold text-white">公开榜单</h2>
              {profile.publicTierLists.length === 0 ? (
                <p className="text-sm text-slate-500">还没有公开榜单</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.publicTierLists.map((tl) => (
                    <Link
                      key={tl.token}
                      href={`/share/tier/${tl.token}`}
                      className="group rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-300/30"
                    >
                      <div className="mb-3 flex h-20 gap-1 overflow-hidden rounded-lg">
                        {tl.coverUrls.slice(0, 5).map((url, i) => (
                          <div key={i} className="flex-1 overflow-hidden rounded bg-black/40 relative">
                            <Image
                              src={proxyExternalImageUrl(url) ?? url}
                              alt=""
                              fill
                              sizes="20vw"
                              className="object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {tl.coverUrls.length === 0 ? (
                          <div className="flex flex-1 items-center justify-center rounded bg-black/40">
                            <span className="text-xs text-slate-600">无封面</span>
                          </div>
                        ) : null}
                      </div>
                      <h3 className="truncate text-sm font-semibold text-white group-hover:text-cyan-300">
                        {tl.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{tl.poolName}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{tl.animeCount} 作品</span>
                        {tl.comparisonCount > 0 ? (
                          <span>{tl.comparisonCount} 对决</span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-white">公开番组</h2>
              {profile.publicPools.length === 0 ? (
                <p className="text-sm text-slate-500">还没有创建公开番组</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.publicPools.map((pool) => (
                    <Link
                      key={pool.id}
                      href={`/pools/${pool.id}`}
                      className="group rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-anime-purple/30"
                    >
                      <div className="mb-3 flex h-20 gap-1 overflow-hidden rounded-lg">
                        {pool.coverUrls.slice(0, 5).map((url, i) => (
                          <div key={i} className="flex-1 overflow-hidden rounded bg-black/40 relative">
                            <Image
                              src={proxyExternalImageUrl(url) ?? url}
                              alt=""
                              fill
                              sizes="20vw"
                              className="object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {pool.coverUrls.length === 0 ? (
                          <div className="flex flex-1 items-center justify-center rounded bg-black/40">
                            <span className="text-xs text-slate-600">无封面</span>
                          </div>
                        ) : null}
                      </div>
                      <h3 className="truncate text-sm font-semibold text-white group-hover:text-anime-purple">
                        {pool.name}
                      </h3>
                      {pool.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {pool.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{pool.animeCount} 作品</span>
                        {pool.tierListCount > 0 ? (
                          <span>{pool.tierListCount} 榜单</span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </PageShell>
  );
}
