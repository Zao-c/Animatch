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
  source: "border-white/15 bg-white/[0.06] text-zinc-200",
  status: "border-white/15 bg-white/[0.06] text-zinc-200",
  tier: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  muted: "border-white/10 bg-white/[0.04] text-zinc-400",
  danger: "border-rose-400/25 bg-rose-400/10 text-rose-200"
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
