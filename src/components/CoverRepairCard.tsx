"use client";

import { useCallback, useState } from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { ErrorAlert } from "./ui/ErrorAlert";
import type { RepairCandidate } from "@/app/api/pools/[poolId]/cover-repair/route";

type RepairScanResult = {
  ok: true;
  data: {
    total: number;
    needsRepair: number;
    autoMatchCount: number;
    manualRequiredCount: number;
    skippedCount: number;
    candidates: RepairCandidate[];
  };
};

type RepairApplyResult = {
  ok: true;
  data: {
    applied: number;
    skipped: number;
    details: {
      applied: Array<{ animeId: string; coverUrl: string }>;
      skipped: string[];
    };
  };
};

export function CoverRepairCard({
  poolId,
  className = ""
}: {
  poolId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<RepairScanResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScanResult(null);
    setApplyResult(null);

    try {
      const res = await fetch(`/api/pools/${encodeURIComponent(poolId)}/cover-repair`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "扫描失败");
        return;
      }
      setScanResult(await res.json());
    } catch {
      setError("网络错误，请重试。");
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  const handleApply = useCallback(async () => {
    if (scanResult === null) return;

    const autoEntries = scanResult.data.candidates
      .filter((c) => c.suggestion === "auto" && c.match !== null)
      .map((c) => ({
        animeId: c.animeId,
        bgmId: (c.match as NonNullable<RepairCandidate["match"]>).bgmId
      }));

    if (autoEntries.length === 0) return;

    setApplying(true);
    setError(null);

    try {
      const res = await fetch(`/api/pools/${encodeURIComponent(poolId)}/cover-repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: autoEntries })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "应用失败");
        return;
      }

      const result: RepairApplyResult = await res.json();
      setApplyResult(`已修复 ${result.data.applied} 张封面。`);
      setScanResult(null);
    } catch {
      setError("网络错误，请重试。");
    } finally {
      setApplying(false);
    }
  }, [scanResult, poolId]);

  const autoCandidates =
    scanResult?.data.candidates.filter((c) => c.suggestion === "auto") ?? [];

  return (
    <AppCard className={`p-5 ${className}`} variant="soft">
      <h3 className="text-sm font-semibold text-white">用 Bangumi 修复封面</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        如果导入的封面失效，可以用 Bangumi 回填封面。
      </p>

      {error ? <ErrorAlert message={error} tone="warning" className="mt-3" /> : null}
      {applyResult ? (
        <p className="mt-3 text-sm text-emerald-300">{applyResult}</p>
      ) : null}

      {scanResult === null && applyResult === null ? (
        <AppButton
          onClick={handleScan}
          disabled={loading}
          variant="ghost"
          size="sm"
          className="mt-3"
        >
          {loading ? "扫描中..." : "修复导入封面"}
        </AppButton>
      ) : null}

      {scanResult !== null && applyResult === null ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>需要修复：{scanResult.data.needsRepair}</span>
            <span className="text-purple-300">可自动匹配：{scanResult.data.autoMatchCount}</span>
            {scanResult.data.manualRequiredCount > 0 ? (
              <span>需手动确认：{scanResult.data.manualRequiredCount}</span>
            ) : null}
          </div>

          {scanResult.data.candidates.length > 0 ? (
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {scanResult.data.candidates.map((candidate) => (
                <div
                  key={candidate.animeId}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2"
                >
                  <AnimeCover
                    src={candidate.currentCoverUrl}
                    title={candidate.title}
                    size="sm"
                    className="shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-medium text-white">
                      {candidate.title}
                    </p>
                    {candidate.suggestion === "auto" && candidate.match ? (
                      <p className="mt-0.5 text-[10px] text-emerald-300">
                        → {candidate.match.titleCn ?? candidate.match.title}
                      </p>
                    ) : candidate.suggestion === "skipped" ? (
                      <AppBadge tone="muted">已有修正</AppBadge>
                    ) : candidate.suggestion === "manual" ? (
                      <p className="mt-0.5 text-[10px] text-amber-300">需手动选择</p>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-slate-500">无法匹配</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {autoCandidates.length > 0 ? (
              <AppButton
                onClick={handleApply}
                disabled={applying}
                variant="primary"
                size="sm"
              >
                {applying ? "应用中..." : `应用可确定的修复（${autoCandidates.length}）`}
              </AppButton>
            ) : null}
            <AppButton
              onClick={() => setScanResult(null)}
              variant="ghost"
              size="sm"
            >
              取消
            </AppButton>
          </div>
        </div>
      ) : null}
    </AppCard>
  );
}
