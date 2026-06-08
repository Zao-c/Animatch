"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { listPools, type PoolSummary } from "@/lib/client-api";

export default function PoolsPage() {
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPools()
      .then((data) => setPools(data.items))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "加载番组失败")
      )
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <PageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">我的番组</h1>
          <p className="mt-2 text-sm text-zinc-400">当前使用开发期临时用户。</p>
        </div>
        <Link
          href="/pools/new"
          className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200"
        >
          新建番组
        </Link>
      </div>

      {isLoading ? <StateText text="正在加载番组..." /> : null}
      {error ? <StateText text={error} tone="error" /> : null}
      {!isLoading && !error && pools.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-white/15 p-10 text-center">
          <p className="text-zinc-300">还没有番组。</p>
          <Link href="/pools/new" className="mt-4 inline-block text-sm font-semibold text-cyan-300">
            去创建
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pools.map((pool) => (
          <Link
            key={pool.id}
            href={`/pools/${pool.id}`}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/25 hover:bg-white/[0.07]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">{pool.name}</h2>
              <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400">
                {pool.visibility}
              </span>
            </div>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-400">
              {pool.description ?? "暂无描述"}
            </p>
            <p className="mt-5 text-xs text-zinc-500">
              更新于 {new Date(pool.updatedAt).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

function StateText({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return (
    <p className={`mt-8 text-sm ${tone === "error" ? "text-red-300" : "text-zinc-400"}`}>
      {text}
    </p>
  );
}
