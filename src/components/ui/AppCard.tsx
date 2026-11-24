import React, { type HTMLAttributes } from "react";

type AppCardVariant = "default" | "soft" | "focus" | "modal";

const VARIANT_CLASS: Record<AppCardVariant, string> = {
  default: "border-white/[0.08] bg-[#14161b] shadow-[0_8px_28px_rgba(0,0,0,0.28)]",
  soft: "border-white/[0.06] bg-white/[0.03]",
  focus: "border-white/[0.12] bg-[#181b21] shadow-[0_14px_38px_rgba(0,0,0,0.4)]",
  modal: "border-white/[0.12] bg-[#181b21] shadow-[0_24px_80px_rgba(0,0,0,0.72)]"
};

export const AppCard = React.forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    soft?: boolean;
    variant?: AppCardVariant;
  }
>(function AppCard({ className = "", soft = false, variant, ...props }, ref) {
  const resolvedVariant = variant ?? (soft ? "soft" : "default");

  return (
    <div
      ref={ref}
      className={[
        "rounded-anime-lg border",
        VARIANT_CLASS[resolvedVariant],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

AppCard.displayName = "AppCard";
