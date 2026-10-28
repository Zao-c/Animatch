"use client";

import Link from "next/link";
import type { usePoolCreation } from "@/lib/use-pool-creation";
import { AppButton, appButtonClasses } from "./ui/AppButton";

export function PoolCreationNotice({ creation }: { creation: ReturnType<typeof usePoolCreation> }) {
  const { record, busy, error, warning, unreadable } = creation;
  if (!creation.ready) return <p role="status" className="text-sm text-slate-400">正在读取账号与创建记录…</p>;
  if (!record && !error && !warning) return null;
  const name = record ? "name" in record.body ? record.body.name : record.body.poolName : "";
  return <section className="my-3 space-y-3 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-4" aria-label="创建状态">
    {record && <><h3 className="font-bold">{record.poolId ? "番组已创建" : busy ? "正在确认创建结果…" : "有一次创建尚待确认"}</h3><p className="break-words text-sm">{name}{"selectedAnimeIds" in record.body ? ` · ${record.body.selectedAnimeIds?.length ?? 0} 部作品` : ""}</p></>}
    {record && <p className="text-xs text-slate-400">{record.body.visibility === "PUBLIC" ? "公开番组" : record.body.visibility === "UNLISTED" ? "仅链接可见" : "私密番组"}</p>}
    {record && !record.poolId && <p className="text-sm text-slate-400">重试会使用原来的名称、可见性和作品清单。已创建则打开原番组，未创建则继续原请求；刷新恢复后不会自动提交。</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    {warning && <p role="alert" className="text-sm text-amber-200">{warning}</p>}
    <div className="flex flex-wrap gap-2">
      {record && !record.poolId && <AppButton disabled={busy} onClick={() => void creation.submit()}>{busy ? "正在确认…" : "重试并确认原创建"}</AppButton>}
      {creation.href && <Link href={creation.href} className={appButtonClasses({ variant: "primary" })}>进入已创建番组</Link>}
      <Link href="/pools?view=mine" className={appButtonClasses({ variant: "ghost" })}>查看我的番组</Link>
      {(record || unreadable) && <AppButton variant="quiet" disabled={busy} onClick={creation.startNew}>{record?.poolId ? "创建另一个番组" : "清除本地记录，重新填写"}</AppButton>}
      {!record && error && <Link href="/login?next=%2Fpools%2Fnew" className={appButtonClasses({ variant: "ghost" })}>登录后继续</Link>}
    </div>
  </section>;
}
