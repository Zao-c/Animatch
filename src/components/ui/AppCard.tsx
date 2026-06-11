import type { HTMLAttributes } from "react";

export function AppCard({
  className = "",
  soft = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  soft?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border backdrop-blur-xl",
        soft
          ? "border-white/10 bg-white/[0.045] shadow-[0_18px_70px_rgba(0,0,0,0.24)]"
          : "border-cyan-100/10 bg-slate-950/48 shadow-[0_24px_90px_rgba(2,6,23,0.42)]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
