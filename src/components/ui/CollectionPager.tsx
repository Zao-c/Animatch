import React from "react";
import { AppButton } from "./AppButton";

export function CollectionPager({ page, total, pageSize, onChange, label = "作品" }: {
  page: number; total: number; pageSize: number; onChange: (page: number) => void; label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label={`${label}分页`} className="flex flex-wrap items-center justify-between gap-2 border-t border-anime-border pt-3">
      <p role="status" className="text-xs text-slate-400">共 {total} {label === "作品" ? "部" : "项"} · 第 {page} / {pages} 页</p>
      <div className="flex gap-2">
        <AppButton type="button" size="sm" variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</AppButton>
        <AppButton type="button" size="sm" variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>下一页</AppButton>
      </div>
    </nav>
  );
}
