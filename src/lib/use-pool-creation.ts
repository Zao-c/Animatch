"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, createPool, createPoolFromQuickImport, getMe } from "./client-api";
import { createClientMutationId } from "./client-id";
import { useUnsavedChanges } from "./use-unsaved-changes";

type Kind = "manual" | "quick";
type ManualBody = Parameters<typeof createPool>[0];
type QuickBody = Parameters<typeof createPoolFromQuickImport>[0];
type Body = ManualBody | QuickBody;
interface CreationRecord { version: 1; kind: Kind; ownerId: string; clientMutationId: string; body: Body; poolId?: string }

function storageKey(ownerId: string, kind: Kind) { return `animatch:pool-creation:${ownerId}:${kind}`; }
function isId(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 200; }

function readRecord(ownerId: string, kind: Kind): CreationRecord | null {
  const raw = sessionStorage.getItem(storageKey(ownerId, kind));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.version === 1 && value.resolved === true) return null;
  if (value?.version !== 1 || value.ownerId !== ownerId || value.kind !== kind || !isId(value.clientMutationId) ||
    !value.body || typeof value.body !== "object" || (value.poolId !== undefined && !isId(value.poolId))) throw new Error("恢复记录无法读取，请先到我的番组确认创建结果。");
  const body = value.body;
  if (kind === "manual" ? typeof body.name !== "string" : typeof body.poolName !== "string" || !body.params || !Array.isArray(body.selectedAnimeIds)) throw new Error("创建内容不完整，请先到我的番组确认结果。");
  // Accept only supported request fields; identity and mutation ID come from the envelope.
  const request: Body = kind === "manual" ? { name: body.name, description: body.description, visibility: body.visibility, tags: body.tags }
    : { poolName: body.poolName, description: body.description, visibility: body.visibility, selectedAnimeIds: body.selectedAnimeIds, params: body.params };
  return { version: 1, kind, ownerId, clientMutationId: value.clientMutationId, body: request, poolId: value.poolId };
}

export function usePoolCreation(kind: Kind, enabled = true) {
  const router = useRouter();
  const [ready, setReady] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<CreationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const owner = useRef<string | null>(null);
  const current = useRef<CreationRecord | null>(null);
  const lock = useRef(false);
  const alive = useRef(false);
  useUnsavedChanges(enabled && !!record && !record.poolId, "创建结果尚未确认，确定离开？返回后请先确认原请求，避免重复创建。");

  useEffect(() => {
    let active = true;
    alive.current = true;
    if (enabled) {
      void getMe().then(({ user }) => {
        if (!active) return;
        if (!user) { setError("请先登录，再创建番组。"); return; }
        owner.current = user.id;
        try {
          const saved = readRecord(user.id, kind);
          current.current = saved;
          setRecord(saved);
        } catch {
          setUnreadable(true);
          setWarning("无法读取本标签页的创建记录。请先到我的番组确认结果，再清除本地记录；当前不会自动重发。");
        }
      }).catch(() => { if (active) setError("暂时无法确认登录账号，请刷新页面后重试。"); })
        .finally(() => { if (active) setReady(true); });
    }
    return () => { active = false; alive.current = false; };
  }, [enabled, kind]);

  function persist(next: CreationRecord, completion = false) {
    try {
      if (completion) {
        const raw = sessionStorage.getItem(storageKey(next.ownerId, kind));
        if (!raw || JSON.parse(raw)?.clientMutationId !== next.clientMutationId) return;
      }
      sessionStorage.setItem(storageKey(next.ownerId, kind), JSON.stringify(next));
      if (alive.current) setWarning(null);
    } catch {
      if (alive.current) setWarning("浏览器暂存不可用。请在本页确认创建结果后再离开；刷新后不保证能恢复。");
    }
  }

  async function submit(body?: Body) {
    if (!enabled || !ready || !owner.current || lock.current || unreadable) return;
    if (current.current?.poolId) { router.push(hrefFor(current.current)); return; }
    if (!current.current && !body) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const wasPending = current.current !== null;
    const attempt: CreationRecord = current.current ?? { version: 1, kind, ownerId: owner.current, clientMutationId: createClientMutationId("create-pool"), body: body! };
    current.current = attempt;
    setRecord(attempt);
    persist(attempt);
    try {
      const identity = { clientMutationId: attempt.clientMutationId, expectedUserId: attempt.ownerId };
      const poolId = kind === "manual"
        ? (await createPool({ ...attempt.body as ManualBody, ...identity })).id
        : (await createPoolFromQuickImport({ ...attempt.body as QuickBody, ...identity })).poolId;
      const completed = { ...attempt, poolId };
      persist(completed, true);
      if (!alive.current) return;
      current.current = completed;
      setRecord(completed);
      router.push(hrefFor(completed));
    } catch (reason) {
      if (!alive.current) return;
      if (!wasPending && reason instanceof ApiClientError && [400, 422].includes(reason.status)) {
        // First-attempt validation failures did not create a pool. Let the user
        // correct the still-visible form, provided its recovery record is cleared.
        try {
          const key = storageKey(attempt.ownerId, kind);
          const raw = sessionStorage.getItem(key);
          if (raw && JSON.parse(raw)?.clientMutationId === attempt.clientMutationId) sessionStorage.removeItem(key);
          current.current = null;
          setRecord(null);
        } catch {
          setWarning("本次内容被拒绝，但恢复记录未能清除。可先查看我的番组，再选择重新填写。");
        }
      }
      // Later rejections do not prove the original request failed. Keep the
      // original payload and ID available for confirmation.
      setError(reason instanceof ApiClientError && reason.status === 410 ? reason.message : reason instanceof Error ? reason.message : "创建结果暂未确认，请重试原请求。");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function startNew() {
    if (lock.current || !owner.current) return;
    if ((current.current && !current.current.poolId || unreadable) && !window.confirm("清除本地恢复记录不会删除已创建的番组，也不能取消服务器正在处理的请求。请先查看我的番组；确定重新填写一次新的创建请求？")) return;
    let storageAvailable = true;
    try {
      const key = storageKey(owner.current, kind);
      try { sessionStorage.removeItem(key); }
      catch { sessionStorage.setItem(key, JSON.stringify({ version: 1, resolved: true })); }
    } catch {
      storageAvailable = false;
    }
    current.current = null;
    setRecord(null);
    setUnreadable(false);
    setError(null);
    setWarning(storageAvailable ? null : "浏览器记录未能清除，已按你的选择开始新的本页请求。请在本页确认结果后再离开；刷新后可能再次看到旧记录。");
  }

  return { ready, busy, record, error, warning, unreadable, submit, startNew,
    locked: !ready || !owner.current || busy || !!record || unreadable,
    href: record?.poolId ? hrefFor(record) : null };
}

function hrefFor(record: CreationRecord) {
  return `/pools/${encodeURIComponent(record.poolId!)}${record.kind === "manual" ? "#add-anime" : ""}`;
}
