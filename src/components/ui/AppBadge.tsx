import type { HTMLAttributes } from "react";

type AppBadgeTone = "source" | "status" | "tier" | "success" | "muted" | "danger";

const TONE_CLASS: Record<AppBadgeTone, string> = {
  source: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  status: "border-purple-300/25 bg-purple-300/10 text-purple-100",
  tier: "border-amber-200/30 bg-amber-200/10 text-amber-100",
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  muted: "border-white/10 bg-white/[0.05] text-slate-300",
  danger: "border-rose-300/25 bg-rose-400/10 text-rose-100"
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        TONE_CLASS[tone],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
