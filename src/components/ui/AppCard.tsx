import React, { type HTMLAttributes } from "react";

type AppCardVariant = "default" | "soft" | "focus" | "modal";

const VARIANT_CLASS: Record<AppCardVariant, string> = {
  default: "border-anime-border bg-anime-panel shadow-anime-panel",
  soft: "border-white/10 bg-white/[0.045] shadow-[0_18px_70px_rgba(0,0,0,0.22)]",
  focus: "border-anime-cyan/25 bg-anime-panelStrong shadow-anime-focus",
  modal: "border-white/15 bg-anime-panelStrong shadow-[0_28px_100px_rgba(2,6,23,0.58)]"
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
        "rounded-anime-lg border backdrop-blur-xl",
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
