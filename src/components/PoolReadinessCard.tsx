"use client";

import React from "react";
import { AppBadge } from "./ui/AppBadge";
import { AppCard } from "./ui/AppCard";
import {
  getReadinessStatusLabel,
  type PoolReadinessReport
} from "@/lib/pool-readiness";

export function PoolReadinessCard({ report }: { report: PoolReadinessReport }) {
  const statusLabel = getReadinessStatusLabel(report.status);
  const statusTone = report.status === "ready" ? "success" : report.status === "blocked" ? "danger" : "source";

  return (
    <AppCard className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold text-white">公开前检查</h3>
        <AppBadge tone={statusTone}>{statusLabel}</AppBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ReadinessMetric
          label="作品数"
          value={String(report.activeCount)}
          tone={report.activeCount >= 8 ? "muted" : report.activeCount < 2 ? "danger" : "source"}
        />
        <ReadinessMetric
          label="缺封面"
          value={String(report.missingCoverCount)}
          tone={report.missingCoverCount === 0 ? "muted" : "source"}
        />
        <ReadinessMetric
          label="可疑标题"
          value={String(report.suspiciousTitleCount)}
          tone={report.suspiciousTitleCount === 0 ? "muted" : "source"}
        />
      </div>

      {report.issues.length > 0 ? (
        <div className="mt-4 space-y-1.5">
          {report.issues.map((issue, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">
                {issue.severity === "error" ? (
                  <span className="text-red-400">✕</span>
                ) : issue.severity === "warning" ? (
                  <span className="text-yellow-400">⚠</span>
                ) : (
                  <span className="text-slate-500">ℹ</span>
                )}
              </span>
              <p
                className={
                  issue.severity === "error"
                    ? "text-red-300"
                    : issue.severity === "warning"
                      ? "text-yellow-300"
                      : "text-slate-400"
                }
              >
                {issue.message}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {report.suggestions.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            建议
          </p>
          {report.suggestions.map((suggestion, index) => (
            <p key={index} className="text-xs text-slate-400">
              {index + 1}. {suggestion}
            </p>
          ))}
        </div>
      ) : null}
    </AppCard>
  );
}

function ReadinessMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "muted" | "source" | "danger";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={
          "text-lg font-bold " +
          (tone === "danger"
            ? "text-red-400"
            : tone === "source"
              ? "text-cyan-300"
              : "text-slate-300")
        }
      >
        {value}
      </p>
    </div>
  );
}
