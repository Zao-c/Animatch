import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";

type StatusHintTone = "guide" | "success" | "warning" | "muted";

const TONE_CLASS: Record<StatusHintTone, string> = {
  guide: "border-cyan-300/18 bg-cyan-300/[0.07]",
  success: "border-emerald-300/18 bg-emerald-300/[0.07]",
  warning: "border-amber-200/20 bg-amber-200/[0.07]",
  muted: "border-white/10 bg-white/[0.04]"
};

const BADGE_TONE: Record<StatusHintTone, "source" | "success" | "tier" | "muted"> = {
  guide: "source",
  success: "success",
  warning: "tier",
  muted: "muted"
};

export function StatusHint({
  label = "引导",
  title,
  description,
  actions,
  tone = "guide",
  className = ""
}: {
  label?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  tone?: StatusHintTone;
  className?: string;
}) {
  return (
    <AppCard
      soft
      role={tone === "warning" ? "alert" : "status"}
      aria-live={tone === "warning" ? "assertive" : "polite"}
      className={[TONE_CLASS[tone], "p-4", className].filter(Boolean).join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <AppBadge tone={BADGE_TONE[tone]}>{label}</AppBadge>
          <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </AppCard>
  );
}
