"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { SongCover } from "@/components/anisong/SongCover";
import { AppBadge } from "@/components/ui/AppBadge";
import { appButtonClasses } from "@/components/ui/AppButton";
import { listPools, type PoolSummary } from "@/lib/client-api";
import { songRequest } from "@/lib/anisong/client";
import type { SongTemplateView } from "@/lib/anisong/types";

function PoolCollage({
  images,
  fallbacks,
  title
}: {
  images: string[];
  fallbacks: (string | null | undefined)[];
  title: string;
}) {
  const visibleImages = images.slice(0, 5);

  if (visibleImages.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center border-b border-white/[0.06] bg-[#101216] px-4 text-sm font-semibold text-zinc-500">
        暂无封面
      </div>
    );
  }

  if (visibleImages.length === 1) {
    return (
      <div className="h-36 overflow-hidden border-b border-white/[0.06] bg-[#101216]">
        <AnimeCover
          src={visibleImages[0]}
          secondarySrc={fallbacks[0] ?? null}
          title={title}
          size="sm"
          className="h-full w-full rounded-none border-0"
        />
      </div>
    );
  }

  if (visibleImages.length <= 3) {
    const colClass = visibleImages.length === 2 ? "grid-cols-2" : "grid-cols-3";
    return (
      <div className={`grid h-36 ${colClass} gap-0.5 overflow-hidden border-b border-white/[0.06] bg-[#101216]`}>
        {visibleImages.map((image, index) => (
          <AnimeCover
            key={`${image}-${index}`}
            src={image}
            secondarySrc={fallbacks[index] ?? null}
            title={title}
            size="sm"
            className="h-full w-full rounded-none border-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-36 grid-cols-[1.35fr_1fr_1fr] grid-rows-2 gap-0.5 overflow-hidden border-b border-white/[0.06] bg-[#101216]">
      <AnimeCover
        src={visibleImages[0]}
        secondarySrc={fallbacks[0] ?? null}
        title={title}
        size="sm"
        className="row-span-2 h-full w-full rounded-none border-0"
      />
      {visibleImages.slice(1, 5).map((image, index) => (
        <AnimeCover
          key={`${image}-${index + 1}`}
          src={image}
          secondarySrc={fallbacks[index + 1] ?? null}
          title={title}
          size="sm"
          className="h-full w-full rounded-none border-0"
        />
      ))}
      {visibleImages.length === 4 ? <div className="bg-[#181b21]" /> : null}
    </div>
  );
}

export function HomeFeaturedShowcase() {
  const [pools, setPools] = useState<PoolSummary[] | null>(null);
  const [templates, setTemplates] = useState<SongTemplateView[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    listPools({ view: "public", sort: "COMPARISON_COUNT" })
      .then((res) => {
        if (!cancelled) {
          const filtered = res.items
            .filter((item) => (item.animeCount ?? 0) >= 2)
            .sort((a, b) => {
              const bCmp = b.comparisonCount ?? 0;
              const aCmp = a.comparisonCount ?? 0;
              if (bCmp !== aCmp) return bCmp - aCmp;
              return (b.animeCount ?? 0) - (a.animeCount ?? 0);
            })
            .slice(0, 4);
          setPools(filtered);
        }
      })
      .catch(() => {
        if (!cancelled) setPools([]);
      });

    songRequest<{ templates: SongTemplateView[] }>("/api/anisong/templates?page=0")
      .then((res) => {
        if (!cancelled) {
          setTemplates(res.templates.slice(0, 3));
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-12 space-y-12">
      <section aria-label="热门公开番组">
        <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-3">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">热门公开番组</h2>
          <Link
            href="/pools?view=public"
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-white sm:text-sm"
          >
            全部 →
          </Link>
        </div>

        {pools === null ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((slot) => (
              <div
                key={slot}
                className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-[#14161b]"
              />
            ))}
          </div>
        ) : pools.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-[#14161b]/60 px-5 py-6 text-sm text-zinc-400">
            暂无公开番组，前往{" "}
            <Link href="/pools?view=public" className="text-zinc-200 underline underline-offset-4 hover:text-white">
              番组大厅
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pools.map((pool) => {
              const summary = pool.communitySummary;
              const subText = summary?.topAnimeTitle
                ? `榜首 · ${summary.topAnimeTitle}`
                : summary && summary.participantCount > 0
                  ? `${summary.participantCount} 人参与`
                  : (pool.comparisonCount ?? 0) > 0
                    ? `${pool.comparisonCount ?? 0} 场对决`
                    : `${pool.animeCount ?? 0} 部作品`;

              return (
                <Link
                  key={pool.id}
                  href={`/pools/${pool.id}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14161b] transition duration-anime hover:border-white/25 hover:bg-[#181b21]"
                >
                  <PoolCollage
                    images={pool.coverImages ?? []}
                    fallbacks={pool.coverImageFallbacks ?? []}
                    title={pool.name}
                  />
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-bold text-white sm:text-base" title={pool.name}>
                        {pool.name}
                      </h3>
                      <AppBadge tone="muted" className="shrink-0">
                        {pool.animeCount} 部
                      </AppBadge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <span className="truncate">{subText}</span>
                      <span className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="动画音乐对决曲单">
        <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-3">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">动画音乐曲单</h2>
          <Link
            href="/anisong"
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-white sm:text-sm"
          >
            全部 →
          </Link>
        </div>

        {templates === null ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className="h-44 animate-pulse rounded-2xl border border-white/[0.06] bg-[#14161b]"
              />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-[#14161b]/60 px-5 py-6 text-sm text-zinc-400">
            暂无公开曲单，前往{" "}
            <Link href="/anisong" className="text-zinc-200 underline underline-offset-4 hover:text-white">
              音乐对决
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {templates.map((template) => {
              const covers = [...new Set(template.covers.filter((src): src is string => Boolean(src)))].slice(0, 5);
              return (
                <Link
                  key={template.id}
                  href={`/anisong/templates/${template.id}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14161b] transition duration-anime hover:border-white/25 hover:bg-[#181b21]"
                >
                  <div className="flex h-28 items-center justify-center gap-0.5 overflow-hidden border-b border-white/[0.06] bg-[#101216]">
                    {covers.length > 0 ? (
                      covers.map((src) => (
                        <SongCover
                          key={src}
                          src={src}
                          title={template.title}
                          className={
                            "!h-full !min-w-0 !rounded-none !border-0 " +
                            (covers.length === 1 ? "!w-28" : "!w-0 flex-1")
                          }
                        />
                      ))
                    ) : (
                      <span className="text-2xl text-zinc-500" aria-label="暂无曲单封面">♪</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-bold text-white sm:text-base" title={template.title}>
                        {template.title}
                      </h3>
                      <AppBadge tone="muted" className="shrink-0">
                        {template.trackCount} 首
                      </AppBadge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <span className="truncate">{template.ownerName} · 可试听 {template.playableCount} 首</span>
                      <span className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="创建与榜单入口" className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-8">
        <p className="text-sm font-medium text-zinc-300">没有想排的池子？自己建一个番组或曲单。</p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/pools/new" className={appButtonClasses({ variant: "primary", size: "md" })}>
            创建番组
          </Link>
          <Link href="/tierlists" className={appButtonClasses({ variant: "secondary", size: "md" })}>
            Tier List
          </Link>
        </div>
      </section>
    </div>
  );
}
