"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import {
  COLOR_PALETTE,
  TIER_TEMPLATES,
  resolveTierRows,
  type PoolTierConfig,
  type TierRowConfig
} from "@/lib/tier-config";

interface Props {
  tierConfig: PoolTierConfig | null;
  onSave: (config: PoolTierConfig) => Promise<void>;
  isSaving: boolean;
  compact?: boolean;
}

const TEMPLATE_NAMES: Record<string, string> = {
  standard: "标准 S/A/B/C/D",
  extended: "六档 SS/S/A/B/C/D",
  chinese: "中文 神作/优秀/不错",
  simple: "简单 喜欢/一般/不喜欢"
};

const MAX_ROWS = 7;
const MIN_ROWS = 2;

export function PoolTierConfigEditor({
  tierConfig,
  onSave,
  isSaving,
  compact = false
}: Props) {
  const initialRows = useMemo(() => resolveTierRows(tierConfig), [tierConfig]);
  const [rows, setRows] = useState<TierRowConfig[]>(() =>
    initialRows.map((row, index) => ({ ...row, order: index }))
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows.map((row, index) => ({ ...row, order: index })));
    setShowConfirm(false);
    setError(null);
  }, [initialRows]);

  function handleTemplateChange(templateName: string) {
    const template = TIER_TEMPLATES[templateName];
    if (template === undefined) return;
    setRows(template.slice(0, MAX_ROWS).map((row, index) => ({ ...row, order: index })));
    setShowConfirm(false);
    setError(null);
  }

  function handleLabelChange(index: number, label: string) {
    setRows((current) => {
      const next = [...current];
      next[index] = { ...next[index], label };
      return next;
    });
  }

  function handleColorChange(index: number, color: string) {
    setRows((current) => {
      const next = [...current];
      next[index] = { ...next[index], color };
      return next;
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return withOrder(next);
    });
  }

  function handleAddRow() {
    if (rows.length >= MAX_ROWS) return;
    setRows((current) =>
      withOrder([
        ...current,
        {
          id: createRowId(current),
          label: `第 ${current.length + 1} 层`,
          color: COLOR_PALETTE[current.length % COLOR_PALETTE.length],
          order: current.length
        }
      ])
    );
    setShowConfirm(false);
  }

  function handleDeleteRow(index: number) {
    if (rows.length <= MIN_ROWS) return;
    setRows((current) => withOrder(current.filter((_, currentIndex) => currentIndex !== index)));
    setShowConfirm(false);
  }

  function handleShowConfirm() {
    const normalizedLabels = rows.map((row) => row.label.trim());
    if (rows.length < MIN_ROWS) {
      setError(`至少需要 ${MIN_ROWS} 行。`);
      return;
    }
    if (rows.length > MAX_ROWS) {
      setError(`最多只能有 ${MAX_ROWS} 行。`);
      return;
    }
    if (normalizedLabels.some((label) => label.length === 0)) {
      setError("每一行都需要一个显示名称。");
      return;
    }
    setError(null);
    setShowConfirm(true);
  }

  async function handleSave() {
    setShowConfirm(false);
    const config: PoolTierConfig = {
      version: 1,
      rows: withOrder(rows).map((row) => ({
        ...row,
        label: row.label.trim()
      }))
    };

    try {
      await onSave(config);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存 Tier 行配置失败");
    }
  }

  return (
    <AppCard className={compact ? "p-4" : "p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-white">Tier 行设置</h3>
            <AppBadge tone="source">最多 {MAX_ROWS} 行</AppBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            行名称和颜色会用于 Tier Wall、分享图和社区榜单展示。
          </p>
        </div>
        <AppButton
          onClick={handleAddRow}
          disabled={rows.length >= MAX_ROWS || isSaving}
          variant="quiet"
          size="sm"
        >
          添加行
        </AppButton>
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
              disabled={isSaving}
            >
              {label}
            </AppButton>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {rows.map((row, index) => (
          <div
            key={`${row.id}-${index}`}
            className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/34 p-2 sm:grid-cols-[36px_minmax(120px,1fr)_minmax(180px,auto)_auto] sm:items-center"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black text-slate-950"
              style={{ backgroundColor: row.color }}
            >
              {index + 1}
            </div>
            <input
              value={row.label}
              onChange={(event) => handleLabelChange(index, event.target.value)}
              maxLength={12}
              className="anime-field text-sm"
              placeholder="行名称"
              disabled={isSaving}
            />
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(index, color)}
                  disabled={isSaving}
                  className={`h-5 w-5 rounded-md border-2 transition-colors ${
                    row.color === color
                      ? "border-cyan-200"
                      : "border-transparent hover:border-white/35"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`设置颜色 ${color}`}
                />
              ))}
            </div>
            <div className="flex gap-1 sm:justify-end">
              <IconButton
                label="上移"
                disabled={index === 0 || isSaving}
                onClick={() => handleMove(index, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                label="下移"
                disabled={index >= rows.length - 1 || isSaving}
                onClick={() => handleMove(index, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                label="删除"
                disabled={rows.length <= MIN_ROWS || isSaving}
                onClick={() => handleDeleteRow(index)}
              >
                ×
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      {showConfirm ? (
        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
          <p className="text-sm leading-6 text-amber-100">
            保存后，当前番组的 Tier Wall 会按新行数和颜色重新分档展示；不会修改历史对决或 Elo。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AppButton onClick={handleSave} disabled={isSaving} variant="primary" size="sm">
              {isSaving ? "保存中..." : "确认保存"}
            </AppButton>
            <AppButton
              onClick={() => setShowConfirm(false)}
              disabled={isSaving}
              variant="ghost"
              size="sm"
            >
              取消
            </AppButton>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AppButton onClick={handleShowConfirm} disabled={isSaving} variant="primary" size="sm">
            {isSaving ? "保存中..." : "保存行和颜色"}
          </AppButton>
          <span className="text-xs text-slate-500">
            当前 {rows.length} 行，最多 {MAX_ROWS} 行。
          </span>
        </div>
      )}
    </AppCard>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function withOrder(rows: TierRowConfig[]): TierRowConfig[] {
  return rows.map((row, index) => ({ ...row, order: index }));
}

function createRowId(rows: TierRowConfig[]): string {
  const used = new Set(rows.map((row) => row.id));
  for (let index = 1; index <= MAX_ROWS; index++) {
    const id = `row${index}`;
    if (!used.has(id)) return id;
  }
  return `row${rows.length + 1}`;
}
