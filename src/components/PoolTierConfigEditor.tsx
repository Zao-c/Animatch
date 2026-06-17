"use client";

import React, { useState } from "react";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { COLOR_PALETTE, TIER_TEMPLATES, resolveTierRows, type PoolTierConfig, type TierRowConfig } from "@/lib/tier-config";

interface Props {
  tierConfig: PoolTierConfig | null;
  onSave: (config: PoolTierConfig) => Promise<void>;
  isSaving: boolean;
}

const TEMPLATE_NAMES: Record<string, string> = {
  standard: "标准 S/A/B/C/D",
  extended: "六档 SS/S/A/B/C/D",
  chinese: "中文 神作/优秀/不错...",
  simple: "简单 喜欢/一般/不喜欢"
};

export function PoolTierConfigEditor({ tierConfig, onSave, isSaving }: Props) {
  const [rows, setRows] = useState<TierRowConfig[]>(() => {
    const resolved = resolveTierRows(tierConfig);
    return resolved.map((r, i) => ({ ...r, order: i }));
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxRows = 7;
  const minRows = 2;

  function handleTemplateChange(templateName: string) {
    const template = TIER_TEMPLATES[templateName];
    if (template === undefined) return;
    setRows(template.map((r, i) => ({ ...r, order: i })));
    setError(null);
  }

  function handleLabelChange(index: number, label: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], label };
      return next;
    });
  }

  function handleColorChange(index: number, color: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], color };
      return next;
    });
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((r, i) => ({ ...r, order: i }));
    });
  }

  function handleMoveDown(index: number) {
    setRows((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((r, i) => ({ ...r, order: i }));
    });
  }

  function handleAddRow() {
    if (rows.length >= maxRows) return;
    setRows((prev) => [
      ...prev,
      {
        id: `row${prev.length + 1}`,
        label: `第${prev.length + 1}行`,
        color: COLOR_PALETTE[prev.length % COLOR_PALETTE.length],
        order: prev.length
      }
    ]);
  }

  function handleDeleteRow(index: number) {
    if (rows.length <= 2) return;
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((r, i) => ({ ...r, order: i }));
    });
  }

  function handleShowConfirm() {
    if (rows.length < 2) {
      setError("至少需要 2 行。");
      return;
    }
    setError(null);
    setShowConfirm(true);
  }

  async function handleSave() {
    setShowConfirm(false);
    const config: PoolTierConfig = {
      version: 1,
      rows: rows.map((r, i) => ({ ...r, order: i }))
    };

    try {
      await onSave(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  return (
    <AppCard className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold text-white">Tier 行设置</h3>
        <AppBadge tone="source">自定义分层</AppBadge>
      </div>

      <div className="mt-4">
        <p className="text-xs text-slate-500">模板</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(TEMPLATE_NAMES).map(([key, label]) => (
            <AppButton
              key={key}
              onClick={() => handleTemplateChange(key)}
              variant="quiet"
              size="sm"
            >
              {label}
            </AppButton>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-xs text-slate-500">当前行（{rows.length} 行）</p>
        {rows.map((row, index) => (
          <div
            key={`${row.id}-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-2"
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-slate-950"
              style={{ backgroundColor: row.color }}
            >
              {index + 1}
            </div>
            <input
              value={row.label}
              onChange={(e) => handleLabelChange(index, e.target.value)}
              maxLength={12}
              className="anime-field w-28 text-sm"
              placeholder="标签"
            />
            <div className="flex gap-1">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(index, color)}
                  className={`h-5 w-5 rounded border-2 transition-colors ${row.color === color ? "border-cyan-300" : "border-transparent hover:border-white/30"}`}
                  style={{ backgroundColor: color }}
                  aria-label={`设置颜色 ${color}`}
                />
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              <AppButton
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                variant="ghost"
                size="sm"
              >
                ↑
              </AppButton>
              <AppButton
                onClick={() => handleMoveDown(index)}
                disabled={index >= rows.length - 1}
                variant="ghost"
                size="sm"
              >
                ↓
              </AppButton>
              <AppButton
                onClick={() => handleDeleteRow(index)}
                disabled={rows.length <= minRows}
                variant="ghost"
                size="sm"
              >
                ✕
              </AppButton>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
          <AppButton onClick={handleAddRow} disabled={rows.length >= maxRows} variant="quiet" size="sm">
            添加行
          </AppButton>
          {rows.length >= maxRows ? (
            <span className="self-center text-xs text-slate-500">最多 {maxRows} 行</span>
          ) : null}
        </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      ) : null}

      {showConfirm ? (
        <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4">
          <p className="text-sm text-yellow-300">
            修改 Tier 行后，现有排名会按新行重新展示；旧分享图不会变化。确定保存吗？
          </p>
          <div className="mt-3 flex gap-2">
            <AppButton onClick={handleSave} disabled={isSaving} variant="primary" size="sm">
              {isSaving ? "保存中..." : "确定保存"}
            </AppButton>
            <AppButton onClick={() => setShowConfirm(false)} disabled={isSaving} variant="ghost" size="sm">
              取消
            </AppButton>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <AppButton onClick={handleShowConfirm} disabled={isSaving} variant="primary" size="sm">
            {isSaving ? "保存中..." : "保存"}
          </AppButton>
        </div>
      )}
    </AppCard>
  );
}
