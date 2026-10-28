import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { SongSnapshot } from "@/lib/anisong/types";
import { PageShell } from "@/components/PageShell";
import { SongTierView } from "@/components/anisong/SongTierView";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "音乐 Tier List · AniMatch", robots: { index: false, follow: false } };
export default async function SongSharePage({ params }: { params: { token: string } }) {
  if (!/^[a-f0-9-]{36}$/.test(params.token)) notFound();
  const board = await prisma.songBoard.findUnique({ where: { shareToken: params.token }, select: { snapshot: true } });
  if (!board?.snapshot) notFound();
  const snapshot = board.snapshot as unknown as SongSnapshot;
  return <PageShell><div className="mx-auto max-w-6xl space-y-6">
    <p className="text-sm tracking-widest text-anime-cyan">ANISONGMATCH</p><h1 className="break-words text-3xl font-black">{snapshot.title}</h1>
    <p className="text-sm text-slate-400">{snapshot.comparisons} 次有效对决 · 个人相对分档 · 分享快照 {snapshot.capturedAt.slice(0, 10)}</p>
    <SongTierView snapshot={snapshot} /><p className="text-sm text-slate-400">「手动」代表作者调整的档位。待比较的歌曲尚未获得自动分档。</p>
    <Link href="/anisong" className="inline-block rounded-xl bg-anime-cyan px-5 py-3 font-semibold text-slate-950">制作我的音乐 Tier List</Link>
  </div></PageShell>;
}
