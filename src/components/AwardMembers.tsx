"use client";
import { useCallback, useEffect, useState } from "react";
import { AppButton } from "./ui/AppButton";
import { featureRequest } from "@/lib/feature-api";
import type { ceremonyMembership } from "@/lib/award-service";
export function AwardMembers({ id, onJoined }: { id: string; onJoined?: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof ceremonyMembership>> | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const api = `/api/ceremonies/${encodeURIComponent(id)}/members`;
  const load = useCallback(async () => { try { setData(await featureRequest(api)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "请登录后申请加入"); } }, [api]);
  useEffect(() => { void load(); }, [load]);
  async function update(value: object) { setBusy(true); try { const next = await featureRequest<NonNullable<typeof data>>(api, { method: "POST", body: JSON.stringify(value) }); setData(next); setError(""); if (next.status === "APPROVED" && !next.isOwner) onJoined?.(); } catch (e) { setError(e instanceof Error ? e.message : "操作失败"); } finally { setBusy(false); } }
  return <div className="my-4 rounded-xl border border-white/10 p-4"><h3 className="font-semibold">{data?.isOwner ? "活动成员" : "加入活动"}</h3>{error && <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p>}
    {data?.isOwner ? <><p className="my-2 text-sm text-slate-400">{data.accessMode === "APPROVAL" ? "仅已批准的成员能填写、投票和查看活动内容。" : "链接模式：持链接的登录用户可参与。"}</p>{data.accessMode === "APPROVAL" && data.members.map((m) => <div key={m.userId} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><span className="text-sm">{m.user.name ?? m.user.username} · {{ PENDING: "待审核", APPROVED: "已加入", REJECTED: "未通过" }[m.status]}</span><div className="flex gap-2"><AppButton disabled={busy || m.status === "APPROVED"} onClick={() => update({ action: "review", userId: m.userId, status: "APPROVED" })}>批准</AppButton><AppButton disabled={busy || m.status === "REJECTED"} variant="quiet" onClick={() => update({ action: "review", userId: m.userId, status: "REJECTED" })}>拒绝 / 移出</AppButton></div></div>)}</>
      : data && <><p className="my-3 text-sm text-slate-300">{data.status === "PENDING" ? "申请已发送，请等待组织者批准后刷新。" : data.status === "REJECTED" ? "申请未通过，请联系组织者。" : data.status === "APPROVED" ? "你可以进入活动。" : "该活动需要组织者确认参与资格。"}</p><AppButton disabled={busy || data.status === "PENDING" || data.status === "REJECTED"} onClick={() => data.status === "APPROVED" ? onJoined?.() : update({ action: "join" })}>{data.status === "APPROVED" ? "进入活动" : "申请加入"}</AppButton></>}
    <AppButton className="mt-2" variant="quiet" disabled={busy} onClick={load}>刷新成员状态</AppButton></div>;
}
