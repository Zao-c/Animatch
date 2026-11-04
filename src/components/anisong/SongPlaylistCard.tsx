import Link from "next/link";
import type { ReactNode } from "react";
import { AppCard } from "@/components/ui/AppCard";
import { AppBadge } from "@/components/ui/AppBadge";
import { SongCover } from "./SongCover";

export function SongPlaylistCard({ title, href, covers, count, playable, progress, tag, children }: {
  title: string; href: string; covers: (string | null | undefined)[];
  count?: number; playable?: number; progress?: number; tag?: string; children: ReactNode;
}) {
  const available = [...new Set(covers.filter((cover): cover is string => Boolean(cover)))];
  return <AppCard className="group flex h-full min-w-0 flex-col overflow-hidden p-0 transition hover:border-anime-cyan/40">
    <Link href={href} className="block min-w-0">
      <div className="flex h-24 items-center justify-center gap-1 overflow-hidden bg-gradient-to-r from-cyan-950/20 via-slate-900 to-violet-950/20 p-2">
        {available.length ? available.slice(0, 5).map(src =>
          <SongCover key={src} src={src} title={title} className={"!h-full !min-w-0 !rounded-md !border-0 " + (available.length === 1 ? "!w-20" : "!w-0 flex-1")} />
        ) : <span className="text-2xl text-cyan-200/35" aria-label="暂无曲单封面">♪</span>}
      </div>
      <div className="space-y-2 px-4 pt-3 sm:px-5">
        <h3 className="line-clamp-2 min-h-7 text-base font-bold leading-6 text-white group-hover:text-cyan-100">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {tag && <AppBadge tone={tag === "公开" ? "success" : "status"}>{tag}</AppBadge>}
          {count !== undefined && <AppBadge tone="muted">{count} 首歌曲</AppBadge>}
        </div>
      </div>
    </Link>
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
      <p className="text-xs leading-5 text-slate-400">{count === undefined ? "进入曲单查看详情" : `可试听 ${playable ?? 0} 首`}{progress !== undefined ? ` · 我的进度 ${progress} 场` : ""}</p>
      <div className="mt-auto space-y-3">{children}</div>
    </div>
  </AppCard>;
}
