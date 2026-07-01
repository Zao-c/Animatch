"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageShell } from "@/components/PageShell";
import { AnimeCover } from "@/components/AnimeCover";
import { TierShareCard } from "@/components/TierShareView";
import { deleteSeason, getSeasonDetail, startSeason, endSeason, getSeasonImpact, updateSeason } from "@/lib/client-api";
import { formatDateTimeStable } from "@/lib/date-format";
import { SeasonImpactPanel } from "@/components/SeasonImpactPanel";
import type { PublicTierShare, SeasonDetail, SeasonPersonalRankingItem, SeasonRankingItem, TierShareSnapshotItem } from "@/lib/client-api";
import { copyTextWithFallback } from "@/lib/browser-copy";
import { exportShareCardAsPng } from "@/lib/share-export";
import { formatTierExportTimestamp, sanitizeFilenameSegment } from "@/lib/tier-export";
import { DEFAULT_TIER_CONFIG, type TierRowConfig } from "@/lib/tier-config";

interface SeasonTierBucket {
  row: TierRowConfig;
  items: SeasonRankingItem[];
}

interface SeasonPersonalTierBucket {
  row: TierRowConfig;
  items: SeasonPersonalRankingItem[];
}

function SeasonSkeleton() {
  return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-white/10" /><div className="h-64 rounded-2xl bg-white/5" /></div>;
}

export default function SeasonDetailPage() {
  const params = useParams<{ poolId: string; seasonId: string }>();
  const { poolId, seasonId } = params;
  const router = useRouter();

  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isPersonalExporting, setIsPersonalExporting] = useState(false);
  const [isSharedExporting, setIsSharedExporting] = useState(false);
  const personalExportRef = useRef<HTMLDivElement | null>(null);
  const sharedExportRef = useRef<HTMLDivElement | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    mode: "CLASSIC" as SeasonDetail["mode"],
    maxVotesPerUser: 50,
    maxVotesPerUserPerDay: "",
    biasVotesPerUser: 3
  });

  const fetchDetail = useCallback(() => {
    getSeasonDetail(poolId, seasonId)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch((e) => { setError(e.message ?? "加载失败"); setLoading(false); });
  }, [poolId, seasonId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (!detail) return;
    setEditForm({
      title: detail.title,
      description: detail.description ?? "",
      mode: detail.mode,
      maxVotesPerUser: detail.maxVotesPerUser,
      maxVotesPerUserPerDay: detail.maxVotesPerUserPerDay ? String(detail.maxVotesPerUserPerDay) : "",
      biasVotesPerUser: detail.biasVotesPerUser
    });
  }, [detail]);

  const handleStart = async () => {
    setActionLoading(true);
    try { await startSeason(poolId, seasonId); fetchDetail(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "启动失败"); }
    finally { setActionLoading(false); }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    try { await endSeason(poolId, seasonId); fetchDetail(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "结束失败"); }
    finally { setActionLoading(false); }
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      await updateSeason(poolId, seasonId, {
        title: editForm.title,
        description: editForm.description,
        mode: editForm.mode,
        maxVotesPerUser: Number(editForm.maxVotesPerUser),
        maxVotesPerUserPerDay:
          editForm.maxVotesPerUserPerDay.trim() === ""
            ? null
            : Number(editForm.maxVotesPerUserPerDay),
        biasVotesPerUser: Number(editForm.biasVotesPerUser)
      });
      fetchDetail();
      setManageOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存赛季失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("删除赛季会同时删除该赛季的投票记录和共享榜单，确定删除吗？");
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteSeason(poolId, seasonId);
      router.push(`/pools/${poolId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除赛季失败");
      setActionLoading(false);
    }
  };

  const handleCopySeasonShare = async () => {
    if (!detail) return;

    const seasonUrl = `${window.location.origin}/pools/${poolId}/seasons/${seasonId}`;
    const shareText = [
      `AniMatch 大乱斗赛季《${detail.title}》`,
      seasonUrl,
      "打开后登录即可开始对决。"
    ].join("\n");
    const result = await copyTextWithFallback(shareText);

    setShareNotice(
      result === "copied"
        ? "已复制赛季分享链接。"
        : `浏览器禁止自动复制，请手动复制地址：${seasonUrl}`
    );
  };

  const seasonTierBuckets = useMemo(
    () => buildSeasonTierBuckets(detail?.ranking ?? [], detail?.tierRows ?? DEFAULT_TIER_CONFIG.rows),
    [detail?.ranking, detail?.tierRows]
  );
  const personalSeasonTierBuckets = useMemo(
    () => buildPersonalSeasonTierBuckets(detail?.currentUserRanking ?? [], detail?.tierRows ?? DEFAULT_TIER_CONFIG.rows),
    [detail?.currentUserRanking, detail?.tierRows]
  );
  const personalSeasonShare = useMemo(
    () => detail ? buildPersonalSeasonShare(detail, personalSeasonTierBuckets) : null,
    [detail, personalSeasonTierBuckets]
  );
  const sharedSeasonShare = useMemo(
    () => detail ? buildSharedSeasonShare(detail, seasonTierBuckets) : null,
    [detail, seasonTierBuckets]
  );
  const recentVotesPreview = detail?.recentVotes.slice(0, 10) ?? [];
  const hiddenRecentVoteCount = Math.max(0, (detail?.recentVotes.length ?? 0) - recentVotesPreview.length);
  const insufficientRankingCount = detail?.ranking.filter((item) => item.insufficientSample).length ?? 0;

  async function handleExportSeasonTier(kind: "personal" | "shared") {
    if (detail === null) return;
    const share = kind === "personal" ? personalSeasonShare : sharedSeasonShare;
    const ref = kind === "personal" ? personalExportRef : sharedExportRef;
    const setLoadingState = kind === "personal" ? setIsPersonalExporting : setIsSharedExporting;

    if (share === null || ref.current === null) {
      setExportError("导出图片失败，榜单还没有准备好。");
      return;
    }

    setLoadingState(true);
    setExportError(null);
    setExportNotice(null);
    const exportedAt = new Date();

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      await exportShareCardAsPng(ref.current, {
        filename: `animatch-season-${kind}-${sanitizeFilenameSegment(detail.title)}-${formatTierExportTimestamp(exportedAt)}`
      });
      setExportNotice(kind === "personal" ? "已导出我的赛季 Tier List。" : "已导出赛季共享 TierList。");
    } catch (reason) {
      setExportError(
        reason instanceof Error
          ? `导出图片失败，可以稍后重试或先截图。(${reason.message})`
          : "导出图片失败，可以稍后重试或先截图。"
      );
    } finally {
      setLoadingState(false);
    }
  }

  if (loading) return <PageShell><main className="mx-auto max-w-6xl px-4 py-8"><SeasonSkeleton /></main></PageShell>;
  if (error) return <PageShell><main className="mx-auto max-w-6xl px-4 py-8"><AppCard className="p-8 text-center"><AppBadge tone="tier">AniMatch</AppBadge><h1 className="mt-4 text-xl font-black text-white">加载失败</h1><p className="mt-2 text-sm text-slate-400">{error}</p></AppCard></main></PageShell>;
  if (!detail) return null;

  return (
    <PageShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href={`/pools/${poolId}`} className="inline-flex min-h-11 items-center text-sm text-slate-400 transition hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300/60">← 返回番组</Link>
        </div>

        <AppCard className="mb-8 p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <AppBadge tone={detail.status === "ACTIVE" ? "success" : detail.status === "ENDED" ? "muted" : "warning"}>
              {detail.status === "ACTIVE" ? "进行中" : detail.status === "ENDED" ? "已结束" : "未开始"}
            </AppBadge>
            <AppBadge tone="source">{detail.mode === "BIAS" ? "偏爱模式" : "传统模式"}</AppBadge>
          </div>
          <h1 className="text-2xl font-black text-white">{detail.title}</h1>
          {detail.description ? <p className="mt-2 text-sm text-slate-400">{detail.description}</p> : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="参与人数" value={String(detail.participantCount)} />
            <StatCard label="总投票" value={String(detail.totalVotes)} />
            <StatCard label="私心票使用" value={String(detail.biasVotesUsed)} />
            <StatCard label="开始时间" value={formatDateTimeStable(detail.startsAt).split(" ")[0]} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>每人最多 {detail.maxVotesPerUser} 票</span>
            {detail.maxVotesPerUserPerDay ? <span>· 每天 {detail.maxVotesPerUserPerDay} 票</span> : null}
            {detail.mode === "BIAS" ? <span>· 私心票 ×{detail.biasVotesPerUser}</span> : null}
            {detail.endsAt ? <span>· 至 {formatDateTimeStable(detail.endsAt).split(" ")[0]}</span> : null}
          </div>

          {detail.currentUserState ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold text-white">我的进度</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <span>已投 {detail.currentUserState.votesUsed} 票</span>
                <span>剩余 {detail.currentUserState.votesRemaining} 票</span>
                {detail.mode === "BIAS" ? <span>私心票已用 {detail.currentUserState.biasVotesUsed}</span> : null}
                {detail.mode === "BIAS" ? <span>私心票剩余 {detail.currentUserState.biasVotesRemaining}</span> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {detail.status === "ACTIVE" ? (
              <Link href={`/pools/${poolId}/seasons/${seasonId}/match`} className={appButtonClasses({ variant: "primary" })}>
                开始对决
              </Link>
            ) : null}
            {detail.status === "DRAFT" ? (
              <AppButton onClick={handleStart} disabled={actionLoading} variant="primary">启动赛季</AppButton>
            ) : null}
            {detail.currentUserCanManage && detail.status === "ACTIVE" ? (
              <AppButton onClick={handleEnd} disabled={actionLoading} variant="danger">结束赛季</AppButton>
            ) : null}
            {detail.currentUserCanManage ? (
              <AppButton onClick={() => setManageOpen((open) => !open)} disabled={actionLoading} variant="secondary">
                管理赛季
              </AppButton>
            ) : null}
            <AppButton type="button" onClick={handleCopySeasonShare} variant="secondary">
              分享赛季
            </AppButton>
          </div>
          {shareNotice ? (
            <p className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs font-medium text-cyan-100">
              {shareNotice}
            </p>
          ) : null}
        </AppCard>

        {detail.currentUserCanManage && manageOpen ? (
          <AppCard className="mb-8 p-6">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">赛季管理</h2>
                <p className="mt-1 text-xs text-slate-500">修改标题、票数和模式；删除会移除该赛季的投票记录。</p>
              </div>
              <AppBadge tone={detail.status === "ENDED" ? "muted" : "source"}>
                {detail.status === "ENDED" ? "已结束赛季不可编辑" : "管理员操作"}
              </AppBadge>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-semibold text-slate-400">标题</span>
                <input
                  value={editForm.title}
                  onChange={(event) => setEditForm((form) => ({ ...form, title: event.target.value }))}
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                  disabled={detail.status === "ENDED" || actionLoading}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-semibold text-slate-400">描述</span>
                <textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))}
                  className="min-h-24 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300/50"
                  disabled={detail.status === "ENDED" || actionLoading}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-slate-400">模式</span>
                  <select
                    value={editForm.mode}
                    onChange={(event) => setEditForm((form) => ({ ...form, mode: event.target.value as SeasonDetail["mode"] }))}
                    className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                    disabled={detail.status === "ENDED" || actionLoading}
                  >
                    <option value="CLASSIC">传统模式</option>
                    <option value="BIAS">偏爱模式</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-slate-400">每人总票数</span>
                  <input
                    type="number"
                    min={1}
                    value={editForm.maxVotesPerUser}
                    onChange={(event) => setEditForm((form) => ({ ...form, maxVotesPerUser: Number(event.target.value) }))}
                    className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                    disabled={detail.status === "ENDED" || actionLoading}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-slate-400">每日票数</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="不限"
                    value={editForm.maxVotesPerUserPerDay}
                    onChange={(event) => setEditForm((form) => ({ ...form, maxVotesPerUserPerDay: event.target.value }))}
                    className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                    disabled={detail.status === "ENDED" || actionLoading}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-slate-400">私心票数</span>
                  <input
                    type="number"
                    min={0}
                    value={editForm.biasVotesPerUser}
                    onChange={(event) => setEditForm((form) => ({ ...form, biasVotesPerUser: Number(event.target.value) }))}
                    className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                    disabled={detail.status === "ENDED" || actionLoading}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <AppButton onClick={handleSave} disabled={detail.status === "ENDED" || actionLoading} variant="primary">
                保存修改
              </AppButton>
              <AppButton onClick={handleDelete} disabled={actionLoading} variant="danger">
                删除赛季
              </AppButton>
            </div>
          </AppCard>
        ) : null}

        {exportError ? (
          <p className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100">
            {exportError}
          </p>
        ) : null}
        {exportNotice ? (
          <p className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-medium text-cyan-100">
            {exportNotice}
          </p>
        ) : null}

        <SeasonPersonalResult
          ranking={detail.currentUserRanking}
          buckets={personalSeasonTierBuckets}
          votesUsed={detail.currentUserState?.votesUsed ?? 0}
          maxVotesPerUser={detail.maxVotesPerUser}
          mode={detail.mode}
          onExport={() => handleExportSeasonTier("personal")}
          isExporting={isPersonalExporting}
        />

        <AppCard className="mb-8 p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">赛季共享榜单</h2>
              <p className="mt-1 text-xs text-slate-500">聚合每位用户的个人赛季 Elo；私心票只在共享榜单阶段产生加成。</p>
            </div>
            <AppBadge tone="source">{detail.participantCount} 人 / {detail.totalVotes} 票</AppBadge>
          </div>
          {insufficientRankingCount > 0 ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs leading-relaxed text-slate-400">
              {insufficientRankingCount} 部作品还未达到 {detail.minSampleThreshold.minUsers} 人、{detail.minSampleThreshold.minComparisons} 次比较的正式排名门槛，当前分数仅作实时参考。
            </div>
          ) : null}
          {detail.ranking.length === 0 ? (
            <p className="text-sm text-slate-500">暂无投票数据</p>
          ) : (
            <div className="space-y-2">
              {detail.ranking.slice(0, 20).map((item, idx) => (
                <div key={item.animeId} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.015] px-4 py-2">
                  <span className="w-8 text-center text-sm font-bold text-amber-200">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span className="text-amber-200 font-semibold">{Math.round(item.score)} Elo</span>
                    <span>{item.winCount} 胜</span>
                    {item.biasWinCount > 0 ? <span className="text-rose-300">{item.biasWinCount} 私心</span> : null}
                    {item.insufficientSample ? <span className="text-slate-500">样本不足</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppCard>

        <SeasonSharedTierList
          buckets={seasonTierBuckets}
          participantCount={detail.participantCount}
          totalVotes={detail.totalVotes}
          minSampleThreshold={detail.minSampleThreshold}
          onExport={() => handleExportSeasonTier("shared")}
          isExporting={isSharedExporting}
        />

        <div className="mb-8">
          <SeasonImpactPanel
            poolId={poolId}
            seasonId={seasonId}
            status={detail.status}
            fetchImpact={getSeasonImpact}
          />
        </div>

        <AppCard className="p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">最近投票</h2>
              <p className="mt-1 text-xs text-slate-500">只展示最新 10 条，完整流水仍保留在赛季记录中。</p>
            </div>
            {hiddenRecentVoteCount > 0 ? (
              <AppBadge tone="muted">已收起 {hiddenRecentVoteCount} 条</AppBadge>
            ) : null}
          </div>
          {detail.recentVotes.length === 0 ? (
            <p className="text-sm text-slate-500">暂无投票记录</p>
          ) : (
            <div className="space-y-2">
              {recentVotesPreview.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="text-xs text-slate-600">第 {v.stepNumber} 步</span>
                  <span className="font-medium text-white/80">{v.displayName}</span>
                  <span className="text-slate-400">
                    {v.voteType === "BIAS" ? (
                      <span className="text-rose-300">用私心票选择</span>
                    ) : "选择"}
                  </span>
                  <span className="font-semibold text-amber-200">{v.winnerTitle}</span>
                  <span className="text-slate-500">胜</span>
                  <span className="text-slate-400">{v.loserTitle}</span>
                  <span className="ml-auto text-xs text-slate-600">权重 {v.weight}</span>
                </div>
              ))}
            </div>
          )}
        </AppCard>

        {personalSeasonShare !== null ? (
          <div className="tiermaker-export-host" aria-hidden="true">
            <div ref={personalExportRef}>
              <TierShareCard share={personalSeasonShare} exportMode />
            </div>
          </div>
        ) : null}
        {sharedSeasonShare !== null ? (
          <div className="tiermaker-export-host" aria-hidden="true">
            <div ref={sharedExportRef}>
              <TierShareCard share={sharedSeasonShare} exportMode />
            </div>
          </div>
        ) : null}
      </main>
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function buildSeasonTierBuckets(
  ranking: SeasonRankingItem[],
  rows: TierRowConfig[] = DEFAULT_TIER_CONFIG.rows
): SeasonTierBucket[] {
  const buckets = rows.map((row) => ({ row, items: [] as SeasonRankingItem[] }));
  const formalItems = [...ranking]
    .filter((item) => !item.insufficientSample)
    .sort((a, b) => b.score - a.score);
  const insufficientItems = [...ranking]
    .filter((item) => item.insufficientSample)
    .sort((a, b) => b.participantCount - a.participantCount || b.comparisonCount - a.comparisonCount);
  const total = formalItems.length;

  if (buckets.length === 0) return buckets;
  if (total === 0) {
    buckets[buckets.length - 1]?.items.push(...insufficientItems);
    return buckets;
  }

  for (let index = 0; index < formalItems.length; index++) {
    const percentile = index / total;
    const bucketIndex =
      rows.length === 5
        ? percentile < 0.1
          ? 0
          : percentile < 0.3
            ? 1
            : percentile < 0.6
              ? 2
              : percentile < 0.85
                ? 3
                : 4
        : Math.min(rows.length - 1, Math.floor(percentile * rows.length));
    buckets[bucketIndex].items.push(formalItems[index]);
  }
  buckets[buckets.length - 1]?.items.push(...insufficientItems);

  return buckets;
}

function buildPersonalSeasonTierBuckets(
  ranking: SeasonPersonalRankingItem[],
  rows: TierRowConfig[] = DEFAULT_TIER_CONFIG.rows
): SeasonPersonalTierBucket[] {
  const buckets = rows.map((row) => ({ row, items: [] as SeasonPersonalRankingItem[] }));
  if (buckets.length === 0) return buckets;

  const sorted = [...ranking].sort((a, b) => b.score - a.score);
  const total = sorted.length;
  if (total === 0) return buckets;

  for (let index = 0; index < sorted.length; index++) {
    const percentile = index / total;
    const bucketIndex =
      rows.length === 5
        ? percentile < 0.1
          ? 0
          : percentile < 0.3
            ? 1
            : percentile < 0.6
              ? 2
              : percentile < 0.85
                ? 3
                : 4
        : Math.min(rows.length - 1, Math.floor(percentile * rows.length));
    buckets[bucketIndex].items.push(sorted[index]);
  }

  return buckets;
}

function buildPersonalSeasonShare(
  detail: SeasonDetail,
  buckets: SeasonPersonalTierBucket[]
): PublicTierShare | null {
  const tiers = buckets.map((bucket) => ({
    key: bucket.row.id,
    label: bucket.row.label,
    color: bucket.row.color,
    items: bucket.items.map(toPersonalShareItem)
  }));
  const animeCount = tiers.reduce((sum, tier) => sum + tier.items.length, 0);
  if (animeCount === 0) return null;

  return buildSeasonTierShare({
    detail,
    token: `season-${detail.id}-personal`,
    title: `${detail.title} · 我的赛季 Tier List`,
    description: "个人赛季 Elo 结果",
    tiers,
    animeCount,
    comparisonCount: detail.currentUserRanking.reduce(
      (sum, item) => sum + item.comparisonCount,
      0
    )
  });
}

function buildSharedSeasonShare(
  detail: SeasonDetail,
  buckets: SeasonTierBucket[]
): PublicTierShare | null {
  const formalTiers = buckets.map((bucket) => ({
    key: bucket.row.id,
    label: bucket.row.label,
    color: bucket.row.color,
    items: bucket.items.filter((item) => !item.insufficientSample).map(toSharedShareItem)
  }));
  const insufficientItems = buckets
    .flatMap((bucket) => bucket.items)
    .filter((item) => item.insufficientSample);
  const tiers = insufficientItems.length > 0
    ? [
        ...formalTiers,
        {
          key: "insufficient",
          label: "样本不足",
          color: "#94a3b8",
          items: insufficientItems.map(toSharedShareItem)
        }
      ]
    : formalTiers;
  const animeCount = tiers.reduce((sum, tier) => sum + tier.items.length, 0);
  if (animeCount === 0) return null;

  return buildSeasonTierShare({
    detail,
    token: `season-${detail.id}-shared`,
    title: `${detail.title} · 赛季共享 TierList`,
    description: "个人赛季 Elo 的匿名聚合结果",
    tiers,
    animeCount,
    comparisonCount: detail.totalVotes
  });
}

function buildSeasonTierShare({
  detail,
  token,
  title,
  description,
  tiers,
  animeCount,
  comparisonCount
}: {
  detail: SeasonDetail;
  token: string;
  title: string;
  description: string;
  tiers: PublicTierShare["snapshot"]["tiers"];
  animeCount: number;
  comparisonCount: number;
}): PublicTierShare {
  const generatedAt = new Date().toISOString();

  return {
    token,
    title,
    description,
    tierLabels: Object.fromEntries(tiers.map((tier) => [tier.key, tier.label])),
    snapshot: {
      version: 1,
      generatedAt,
      pool: {
        id: detail.poolId,
        name: detail.title
      },
      run: {
        id: token
      },
      tiers,
      tierRows: detail.tierRows,
      animeCount,
      comparisonCount
    },
    createdAt: generatedAt
  };
}

function toPersonalShareItem(item: SeasonPersonalRankingItem): TierShareSnapshotItem {
  return {
    animeId: item.animeId,
    title: item.title,
    coverUrl: item.imageUrl,
    imageUrl: item.imageUrl,
    imageMediumUrl: item.imageUrl,
    imageLargeUrl: item.imageUrl,
    source: "season-personal",
    elo: item.score
  };
}

function toSharedShareItem(item: SeasonRankingItem): TierShareSnapshotItem {
  return {
    animeId: item.animeId,
    title: item.title,
    coverUrl: item.imageUrl,
    imageUrl: item.imageUrl,
    imageMediumUrl: item.imageUrl,
    imageLargeUrl: item.imageUrl,
    source: "season-shared",
    elo: item.score
  };
}

function SeasonPersonalResult({
  ranking,
  buckets,
  votesUsed,
  maxVotesPerUser,
  mode,
  onExport,
  isExporting
}: {
  ranking: SeasonPersonalRankingItem[];
  buckets: SeasonPersonalTierBucket[];
  votesUsed: number;
  maxVotesPerUser: number;
  mode: SeasonDetail["mode"];
  onExport: () => void;
  isExporting: boolean;
}) {
  const hasItems = ranking.length > 0;
  const progress = maxVotesPerUser > 0
    ? Math.min(100, Math.round((votesUsed / maxVotesPerUser) * 100))
    : 0;

  return (
    <AppCard className="mb-8 p-6" variant="focus">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <AppBadge tone="tier">个人赛季结果</AppBadge>
          <h2 className="mt-3 text-lg font-bold text-white">我的赛季 Tier List</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            只根据你在这个赛季里的个人 Elo 排序；私心票不会放大这里的 Elo，只会在赛季共享榜单聚合时产生加成。
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="min-w-40 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
            <p className="text-xs text-slate-500">我的进度</p>
            <p className="mt-1 text-xl font-black text-white">{votesUsed} / {maxVotesPerUser}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {hasItems ? (
            <AppButton type="button" onClick={onExport} disabled={isExporting} variant="secondary" size="sm">
              {isExporting ? "导出中..." : "导出我的赛季图"}
            </AppButton>
          ) : null}
        </div>
      </div>

      {!hasItems ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <p className="text-sm font-semibold text-amber-100">你还没有生成个人赛季结果。</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            开始对决后，这里会展示只属于你的赛季 Tier List；它和下方多人聚合的赛季共享榜单分开计算。
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
            {buckets.map(({ row, items }) => (
              <div
                key={row.id}
                className="grid min-h-24 grid-cols-[56px_1fr] border-b border-white/10 last:border-b-0 sm:grid-cols-[72px_1fr]"
              >
                <div className="flex items-start justify-center bg-white/[0.035] px-2 py-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold text-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:h-12 sm:w-12 sm:text-xl"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.label}
                  </span>
                </div>
                <div className="flex min-h-24 flex-wrap content-start gap-3 bg-slate-950/20 p-3 sm:gap-4 sm:p-4">
                  {items.length === 0 ? (
                    <span className="self-center text-xs text-slate-600">等待更多个人对决</span>
                  ) : (
                    items.map((item) => <SeasonPersonalTierCard key={item.animeId} item={item} />)
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white">我的前 10</h3>
              <AppBadge tone={mode === "BIAS" ? "warning" : "muted"}>
                {mode === "BIAS" ? "私心只影响共享榜" : "个人 Elo"}
              </AppBadge>
            </div>
            <div className="mt-4 space-y-2">
              {ranking.slice(0, 10).map((item, index) => (
                <div key={item.animeId} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                  <span className="text-center text-xs font-black text-amber-200">#{index + 1}</span>
                  <p className="min-w-0 truncate text-xs font-semibold text-white">{item.title}</p>
                  <span className="text-xs font-bold text-amber-100">{Math.round(item.score)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppCard>
  );
}

function SeasonSharedTierList({
  buckets,
  participantCount,
  totalVotes,
  minSampleThreshold,
  onExport,
  isExporting
}: {
  buckets: SeasonTierBucket[];
  participantCount: number;
  totalVotes: number;
  minSampleThreshold: SeasonDetail["minSampleThreshold"];
  onExport: () => void;
  isExporting: boolean;
}) {
  const hasItems = buckets.some((bucket) => bucket.items.length > 0);
  const formalBuckets = buckets.map((bucket) => ({
    row: bucket.row,
    items: bucket.items.filter((item) => !item.insufficientSample)
  }));
  const formalItemCount = formalBuckets.reduce((sum, bucket) => sum + bucket.items.length, 0);
  const insufficientItems = buckets
    .flatMap((bucket) => bucket.items)
    .filter((item) => item.insufficientSample);

  return (
    <AppCard className="mb-8 p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">赛季共享 TierList</h2>
          <p className="mt-1 text-xs text-slate-500">
            达到 {minSampleThreshold.minUsers} 人、{minSampleThreshold.minComparisons} 次比较后才进入 S/A/B/C/D，样本不足会先单独暂存。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AppBadge tone="tier">{participantCount} 人 / {totalVotes} 票</AppBadge>
          {hasItems ? (
            <AppButton type="button" onClick={onExport} disabled={isExporting} variant="secondary" size="sm">
              {isExporting ? "导出中..." : "导出共享赛季图"}
            </AppButton>
          ) : null}
        </div>
      </div>

      {!hasItems ? (
        <p className="text-sm text-slate-500">暂无投票数据，开始对决后会生成赛季共享 TierList。</p>
      ) : (
        <div className="space-y-4">
          {formalItemCount > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
              {formalBuckets.map(({ row, items }) => (
                <div
                  key={row.id}
                  className="grid min-h-24 grid-cols-[56px_1fr] border-b border-white/10 last:border-b-0 sm:grid-cols-[72px_1fr]"
                >
                  <div className="flex items-start justify-center bg-white/[0.035] px-2 py-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold text-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:h-12 sm:w-12 sm:text-xl"
                      style={{ backgroundColor: row.color }}
                    >
                      {row.label}
                    </span>
                  </div>
                  <div className="flex min-h-24 flex-wrap content-start gap-3 bg-slate-950/20 p-3 sm:gap-4 sm:p-4">
                    {items.length === 0 ? (
                      <span className="self-center text-xs text-slate-600">等待达标作品</span>
                    ) : (
                      items.map((item) => <SeasonTierCard key={item.animeId} item={item} />)
                    )}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-semibold text-amber-100">社区样本还不够，暂不划分 S/A/B/C/D。</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                当前结果更接近个人赛季 Elo 的实时预览。等更多玩家参与后，作品会自动进入正式分档。
              </p>
            </div>
          )}

          {insufficientItems.length > 0 ? (
            <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">样本不足区</h3>
                  <p className="mt-1 text-xs text-slate-500">这些作品已有投票，但还没达到正式社区分档门槛。</p>
                </div>
                <AppBadge tone="muted">{insufficientItems.length} 部等待更多投票</AppBadge>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {insufficientItems.map((item) => <SeasonTierCard key={item.animeId} item={item} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppCard>
  );
}

function SeasonPersonalTierCard({ item }: { item: SeasonPersonalRankingItem }) {
  return (
    <article className="w-28 rounded-xl border border-white/10 bg-slate-950/72 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:w-32">
      <AnimeCover
        src={item.imageUrl}
        title={item.title}
        size="sm"
        fit="cover"
        className="h-32 w-full rounded-lg sm:h-36"
      />
      <h3 className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-white">
        {item.title}
      </h3>
      <p className="mt-1 text-[10px] text-slate-500">
        {Math.round(item.score)} Elo · {item.winCount} 胜 · {item.comparisonCount} 次
      </p>
    </article>
  );
}

function SeasonTierCard({ item }: { item: SeasonRankingItem }) {
  return (
    <article className="w-28 rounded-xl border border-white/10 bg-slate-950/72 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:w-32">
      <AnimeCover
        src={item.imageUrl}
        title={item.title}
        size="sm"
        fit="cover"
        className="h-32 w-full rounded-lg sm:h-36"
      />
      <h3 className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-white">
        {item.title}
      </h3>
      <p className="mt-1 text-[10px] text-slate-500">
        {Math.round(item.score)} Elo · {item.winCount} 胜{item.insufficientSample ? " · 样本不足" : ""}
      </p>
    </article>
  );
}
