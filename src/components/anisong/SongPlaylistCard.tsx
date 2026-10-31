import Link from "next/link";
import type { ReactNode } from "react";
import { AppCard } from "@/components/ui/AppCard";
import { SongCover } from "./SongCover";
export function SongPlaylistCard({ title, href, covers, count, playable, progress, children }: { title: string; href: string; covers: (string | null | undefined)[]; count?: number; playable?: number; progress?: number; children: ReactNode }) {
  return <AppCard className="group flex min-w-0 flex-col gap-4 p-4 transition sm:p-5 hover:border-anime-cyan/40">
    <Link href={href} className="block min-w-0"><div className="mb-4 grid aspect-[16/9] grid-cols-2 overflow-hidden rounded-xl bg-slate-950">{[0,1].map(i => <SongCover key={i} src={covers[i]} title={title} className="!h-full !w-full !aspect-auto !rounded-none !border-0" />)}</div><h3 className="line-clamp-2 text-lg font-bold text-white group-hover:text-cyan-100">{title}</h3></Link>
    <p className="text-xs text-slate-400">{count === undefined ? "进入曲单查看歌曲与试听状态" : `${count} 首歌曲 · 可试听 ${playable ?? 0} 首`}</p>
    <p className="text-xs text-slate-400">{progress === undefined ? "每个人独立保存对决进度" : `我的进度 · ${progress} 场有效对决`}</p>
    <div className="mt-auto space-y-3">{children}</div>
  </AppCard>;
}
