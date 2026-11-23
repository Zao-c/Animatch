"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  adminLogin,
  adminLogout,
  getAdminPools,
  getMe,
  updateAdminPool,
  type AdminPoolItem,
  type AdminPoolsResponse,
  type AuthUser
} from "@/lib/client-api";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatPoolVisibility } from "@/lib/pool-labels";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  LOCKED: "已锁定",
  ARCHIVED: "已归档"
};

const STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-slate-500/20 text-slate-300",
  PUBLISHED: "bg-emerald-500/20 text-emerald-300",
  LOCKED: "bg-amber-500/20 text-amber-300",
  ARCHIVED: "bg-rose-500/20 text-rose-300"
};

type AdminDangerousAction = "archive" | "restoreArchived" | "softDelete" | "restoreDeleted";

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        STATUS_TONES[status] ?? "bg-slate-500/20 text-slate-300"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [adminCode, setAdminCode] = useState("");
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [pools, setPools] = useState<AdminPoolItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingPools, setLoadingPools] = useState(false);
  const [poolError, setPoolError] = useState("");

  const [q, setQ] = useState("");
  const [filterVisibility, setFilterVisibility] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDeleted, setFilterDeleted] = useState("active");
  const [filterDemo, setFilterDemo] = useState("");

  const [editTarget, setEditTarget] = useState<AdminPoolItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<{
    pool: AdminPoolItem;
    action: AdminDangerousAction;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const pageHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const editNameInputRef = useRef<HTMLInputElement | null>(null);
  const confirmPhraseInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const shouldFocusHeadingRef = useRef(false);

  useEffect(() => {
    getMe()
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  useEffect(() => {
    if (!adminLoggedIn) return;
    loadPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLoggedIn, page, filterVisibility, filterStatus, filterDeleted, filterDemo]);

  const loadPools = useCallback(async () => {
    setLoadingPools(true);
    setPoolError("");
    try {
      const data = await getAdminPools({
        q: q || undefined,
        visibility: filterVisibility || undefined,
        status: filterStatus || undefined,
        deleted: filterDeleted,
        demo: filterDemo || undefined,
        page,
        limit: 20
      });
      setPools(data.items);
      setTotal(data.total);
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : "Failed to load pools");
    } finally {
      setLoadingPools(false);
    }
  }, [q, filterVisibility, filterStatus, filterDeleted, filterDemo, page]);

  const openEditor = (pool: AdminPoolItem) => {
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setEditTarget(pool);
    setEditName(pool.name);
    setEditDescription(pool.description ?? "");
    setEditVisibility(pool.visibility);
    setEditError("");
  };

  const openDangerousAction = (pool: AdminPoolItem, action: AdminDangerousAction) => {
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setConfirmPhrase("");
    setConfirmTarget({ pool, action });
  };

  const closeEditor = useCallback(() => {
    if (!editLoading) {
      setEditTarget(null);
    }
  }, [editLoading]);

  const closeDangerousAction = useCallback(() => {
    if (!confirmLoading) {
      setConfirmTarget(null);
      setConfirmPhrase("");
    }
  }, [confirmLoading]);

  useEffect(() => {
    const isDialogOpen = editTarget !== null || confirmTarget !== null;

    if (!isDialogOpen) {
      const focusTarget = shouldFocusHeadingRef.current
        ? pageHeadingRef.current
        : lastFocusedElementRef.current;
      shouldFocusHeadingRef.current = false;
      if (focusTarget?.isConnected) {
        focusTarget.focus();
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initialFocus = editTarget !== null ? editNameInputRef.current : confirmPhraseInputRef.current;
    const focusTimer = window.setTimeout(() => initialFocus?.focus(), 0);

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      const isBusy = editLoading || confirmLoading;

      if (event.key === "Escape" && !isBusy) {
        event.preventDefault();
        if (editTarget !== null) closeEditor();
        if (confirmTarget !== null) closeDangerousAction();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = document.querySelector<HTMLElement>("[data-admin-dialog='true']");
      const focusable = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]"
          )).filter((element) => element.tabIndex >= 0)
        : [];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDangerousAction, closeEditor, confirmLoading, confirmTarget, editLoading, editTarget]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      await adminLogin(adminCode);
      setAdminLoggedIn(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await adminLogout().catch(() => {});
    setAdminLoggedIn(false);
    setPools([]);
    setTotal(0);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPools();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true);
    setEditError("");
    try {
      await updateAdminPool(editTarget.id, {
        name: editName,
        description: editDescription || undefined,
        visibility: editVisibility
      });
      await loadPools();
      shouldFocusHeadingRef.current = true;
      setEditTarget(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDangerousAction = async () => {
    if (!confirmTarget || confirmPhrase !== "CONFIRM") return;
    setConfirmLoading(true);
    try {
      const body: Record<string, unknown> = { confirm: confirmPhrase };
      if (confirmTarget.action === "archive") body.archive = true;
      if (confirmTarget.action === "restoreArchived") body.restoreArchived = true;
      if (confirmTarget.action === "softDelete") body.softDelete = true;
      if (confirmTarget.action === "restoreDeleted") body.restoreDeleted = true;
      await updateAdminPool(confirmTarget.pool.id, body as any);
      await loadPools();
      shouldFocusHeadingRef.current = true;
      setConfirmTarget(null);
      setConfirmPhrase("");
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setConfirmLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  if (loadingUser) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-slate-400">加载中...</p>
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-white">站长后台</h1>
          <p className="mt-4 text-slate-400">请先登录后才能访问站长后台。</p>
          <Link
            href="/login?next=/admin"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            前往登录
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!adminLoggedIn) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-20">
          <h1 className="text-center text-2xl font-bold text-white">站长后台</h1>
          <p className="mt-4 text-center text-sm text-slate-400">
            请输入站长操作码以访问后台管理功能。
          </p>
          <form onSubmit={handleAdminLogin} className="mt-8">
            <label className="block text-sm font-medium text-slate-300">
              操作码
            </label>
            <input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="请输入站长操作码"
              autoComplete="off"
            />
            {authError ? (
              <p className="mt-3 text-sm text-red-400">{authError}</p>
            ) : null}
            <AppButton
              type="submit"
              disabled={authLoading}
              className="mt-4 w-full"
            >
              {authLoading ? "验证中..." : "验证"}
            </AppButton>
          </form>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 ref={pageHeadingRef} tabIndex={-1} className="text-2xl font-bold text-white">站长后台</h1>
            <p className="mt-2 text-xs text-amber-400">
              站长操作会影响所有用户可见内容。不会硬删除对决记录；归档和软删除可恢复。
            </p>
          </div>
          <AppButton onClick={handleAdminLogout} size="sm" variant="ghost">
            退出站长模式
          </AppButton>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-400">
                搜索
              </label>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="按名称搜索..."
              />
            </div>
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-slate-400">
                可见性
              </label>
              <select
                value={filterVisibility}
                onChange={(e) => {
                  setFilterVisibility(e.target.value);
                  setPage(1);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="PUBLIC">公开</option>
                <option value="PRIVATE">私密</option>
                <option value="UNLISTED">不公开列表</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-slate-400">
                状态
              </label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="DRAFT">草稿</option>
                <option value="PUBLISHED">已发布</option>
                <option value="LOCKED">已锁定</option>
                <option value="ARCHIVED">已归档</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-slate-400">
                删除状态
              </label>
              <select
                value={filterDeleted}
                onChange={(e) => {
                  setFilterDeleted(e.target.value);
                  setPage(1);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="active">未删除</option>
                <option value="deleted">已删除</option>
                <option value="all">全部</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-slate-400">
                体验池
              </label>
              <select
                value={filterDemo}
                onChange={(e) => {
                  setFilterDemo(e.target.value);
                  setPage(1);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="true">体验番组</option>
                <option value="false">非体验</option>
              </select>
            </div>
            <div className="flex items-end">
              <AppButton type="submit" size="sm">
                搜索
              </AppButton>
            </div>
          </div>
        </form>

        {poolError ? (
          <ErrorAlert message={poolError} className="mb-4" />
        ) : null}

        {loadingPools ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-slate-400">加载中...</p>
          </div>
        ) : pools.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-slate-400">没有找到匹配的番组。</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      名称
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      创建者
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      可见性
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      状态
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      标记
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      作品数
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      更新时间
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-400">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((pool) => (
                    <tr
                      key={pool.id}
                      className="border-b border-slate-800/50 transition hover:bg-slate-800/30"
                    >
                      <td className="max-w-[200px] px-4 py-3">
                        <div className="truncate font-medium text-white">
                          {pool.name}
                        </div>
                        {pool.description ? (
                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            {pool.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {pool.creator
                          ? pool.creator.name ?? pool.creator.username
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400">
                          {formatPoolVisibility(pool.visibility)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={pool.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {pool.isOfficialDemo ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                              Demo
                            </span>
                          ) : null}
                          {pool.deletedAt ? (
                            <span className="inline-flex items-center rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                              已删除
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {pool.animeCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDateTimeStable(pool.updatedAt) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <AppButton
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              window.open(`/pools/${pool.id}`, "_blank");
                            }}
                          >
                            详情
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditor(pool)}
                          >
                            编辑
                          </AppButton>
                          {pool.status !== "ARCHIVED" && !pool.deletedAt ? (
                            <AppButton
                              size="sm"
                              variant="ghost"
                              onClick={() => openDangerousAction(pool, "archive")}
                            >
                              归档
                            </AppButton>
                          ) : null}
                          {pool.status === "ARCHIVED" && !pool.deletedAt ? (
                            <AppButton
                              size="sm"
                              variant="ghost"
                              onClick={() => openDangerousAction(pool, "restoreArchived")}
                            >
                              恢复
                            </AppButton>
                          ) : null}
                          {!pool.deletedAt ? (
                            <AppButton
                              size="sm"
                              variant="ghost"
                              className="text-rose-400 hover:text-rose-300"
                              onClick={() => openDangerousAction(pool, "softDelete")}
                            >
                              软删除
                            </AppButton>
                          ) : null}
                          {pool.deletedAt ? (
                            <AppButton
                              size="sm"
                              variant="ghost"
                              className="text-emerald-400 hover:text-emerald-300"
                              onClick={() => openDangerousAction(pool, "restoreDeleted")}
                            >
                              恢复
                            </AppButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <AppButton
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </AppButton>
                <span className="text-sm text-slate-400">
                  {page} / {totalPages}
                </span>
                <AppButton
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </AppButton>
              </div>
            ) : null}
          </>
        )}

        {editTarget ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeEditor();
            }}
          >
            <div
              data-admin-dialog="true"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-edit-dialog-title"
              aria-busy={editLoading}
              className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6"
            >
              <h2 id="admin-edit-dialog-title" className="text-lg font-bold text-white">编辑番组</h2>
              <form onSubmit={handleUpdate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    名称
                  </label>
                  <input
                    ref={editNameInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    maxLength={80}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    描述
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    可见性
                  </label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="PRIVATE">私密</option>
                    <option value="PUBLIC">公开</option>
                    <option value="UNLISTED">不公开列表</option>
                  </select>
                </div>
                {editError ? (
                  <p className="text-sm text-red-400">{editError}</p>
                ) : null}
                <div className="flex gap-3 pt-2">
                  <AppButton
                    type="button"
                    variant="ghost"
                    onClick={closeEditor}
                    disabled={editLoading}
                    className="flex-1"
                  >
                    取消
                  </AppButton>
                  <AppButton
                    type="submit"
                    disabled={editLoading}
                    className="flex-1"
                  >
                    {editLoading ? "保存中..." : "保存"}
                  </AppButton>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {confirmTarget ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDangerousAction();
            }}
          >
            <div
              data-admin-dialog="true"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="admin-danger-dialog-title"
              aria-describedby="admin-danger-dialog-description"
              aria-busy={confirmLoading}
              className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-slate-900 p-6"
            >
              <h2 id="admin-danger-dialog-title" className="text-lg font-bold text-amber-400">确认操作</h2>
              <p id="admin-danger-dialog-description" className="mt-2 text-sm text-slate-300">
                {confirmTarget.action === "archive" &&
                  `确定要归档「${confirmTarget.pool.name}」吗？归档后用户无法参与对决。`}
                {confirmTarget.action === "restoreArchived" &&
                  `确定要恢复「${confirmTarget.pool.name}」的归档状态吗？`}
                {confirmTarget.action === "softDelete" &&
                  `确定要软删除「${confirmTarget.pool.name}」吗？软删除后番组将无法访问。`}
                {confirmTarget.action === "restoreDeleted" &&
                  `确定要恢复「${confirmTarget.pool.name}」的删除状态吗？`}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                此操作需要输入 CONFIRM 确认。
              </p>
              <label className="mt-3 block text-sm font-medium text-slate-300">
                输入 CONFIRM
                <input
                  ref={confirmPhraseInputRef}
                  type="text"
                  value={confirmPhrase}
                  onChange={(event) => setConfirmPhrase(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={confirmLoading}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white transition focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </label>
              <div className="mt-4 flex gap-3">
                <AppButton
                  type="button"
                  variant="ghost"
                  onClick={closeDangerousAction}
                  disabled={confirmLoading}
                  className="flex-1"
                >
                  取消
                </AppButton>
                <AppButton
                  type="button"
                  variant="danger"
                  disabled={confirmLoading || confirmPhrase !== "CONFIRM"}
                  onClick={handleDangerousAction}
                  className="flex-1"
                >
                  {confirmLoading ? "处理中..." : "确认"}
                </AppButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
