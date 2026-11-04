"use client";

import { useEffect, useState } from "react";
import { featureRequest } from "@/lib/feature-api";
import type { getTasteProfile } from "@/lib/taste-service";

type Taste = Awaited<ReturnType<typeof getTasteProfile>>;

export function ProfileTastePreview({ username, onExplore }: { username: string; onExplore: () => void }) {
  const [data, setData] = useState<Taste | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading"); setData(null);
    featureRequest<Taste>("/api/users/" + encodeURIComponent(username) + "/taste", { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setData(result); setState("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [username]);
  const tags = data?.profile.tags.slice(0, 5) ?? [];
  const favorites = data?.profile.favorites.slice(0, 3) ?? [];
  return <section aria-label="口味速览" className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#15223c]/85 to-slate-950/50 p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-white">口味速览</h2>
      <button type="button" onClick={onExplore} className="min-h-10 text-sm font-semibold text-cyan-200 hover:underline">完整分析 →</button>
    </div>
    {state === "loading" ? <p role="status" className="mt-4 text-sm text-slate-400">正在载入口味…</p> :
      state === "error" ? <p className="mt-4 text-sm text-slate-400">暂时无法载入口味数据。</p> :
      <div className="mt-4 space-y-5">
        {tags.length ? <div className="flex flex-wrap gap-2">{tags.map(item =>
          <span key={item.tag} className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-xs text-cyan-100">{item.tag}</span>
        )}</div> : <p className="text-sm text-slate-400">还没有足够的题材数据。</p>}
        {favorites.length > 0 && <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-400">常排前面的作品</p>
          <ul className="space-y-2">{favorites.map(item => <li key={item.animeId} className="line-clamp-2 text-sm text-slate-200">{item.title}</li>)}</ul>
        </div>}
        {data?.profile.animeCount ? <p className="text-xs text-slate-500">已评价 {data.profile.animeCount} 部作品</p> : null}
      </div>}
  </section>;
}
