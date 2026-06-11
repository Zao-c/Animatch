import React, { type HTMLAttributes } from "react";

type AppBadgeTone =
  | "source"
  | "status"
  | "tier"
  | "success"
  | "warning"
  | "muted"
  | "danger";

const TONE_CLASS: Record<AppBadgeTone, string> = {
  source: "border-anime-cyan/25 bg-anime-cyan/10 text-cyan-100",
  status: "border-anime-purple/25 bg-anime-purple/10 text-purple-100",
  tier: "border-anime-amber/35 bg-anime-amber/10 text-amber-100",
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  warning: "border-anime-amber/35 bg-anime-amber/10 text-amber-100",
  muted: "border-white/10 bg-white/[0.05] text-slate-300",
  danger: "border-anime-danger/25 bg-anime-danger/10 text-rose-100"
};

export function AppBadge({
  tone = "muted",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: AppBadgeTone;
}) {
  return (
    <span
      className={[
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-4",
        TONE_CLASS[tone],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
