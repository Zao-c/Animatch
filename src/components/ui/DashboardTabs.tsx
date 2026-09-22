"use client";

import React, { useRef } from "react";

export function DashboardTabs<T extends string>({ id, label, value, items, onChange }: {
  id: string;
  label: string;
  value: T;
  items: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-2xl border border-anime-border bg-anime-panel p-1.5">
      {items.map((item, index) => (
        <button key={item.value} ref={(node) => { buttons.current[index] = node; }} type="button"
          id={`${id}-tab-${item.value}`} role="tab" aria-selected={value === item.value}
          aria-controls={`${id}-panel-${item.value}`} tabIndex={value === item.value ? 0 : -1}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % items.length;
            else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = items.length - 1;
            else return;
            event.preventDefault();
            onChange(items[next].value);
            buttons.current[next]?.focus();
          }}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition sm:flex-none sm:px-5 ${value === item.value ? "bg-anime-purple/20 text-purple-100 ring-1 ring-anime-purple/35" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
          {item.label}
          {item.count !== undefined ? <span className="text-xs opacity-70">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
