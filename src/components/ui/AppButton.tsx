import React, { type ButtonHTMLAttributes } from "react";

type AppButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type AppButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary:
    "border-cyan-300/70 bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(3,218,197,0.22)] hover:bg-cyan-200 hover:shadow-[0_0_36px_rgba(3,218,197,0.32)]",
  secondary:
    "border-purple-300/35 bg-purple-300/10 text-purple-100 hover:border-purple-200/60 hover:bg-purple-300/18",
  danger:
    "border-rose-300/35 bg-rose-400/10 text-rose-100 hover:border-rose-200/60 hover:bg-rose-400/18",
  ghost:
    "border-white/10 bg-white/[0.04] text-slate-100 hover:border-cyan-200/35 hover:bg-white/[0.08]"
};

const SIZE_CLASS: Record<AppButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-sm"
};

export function appButtonClasses({
  variant = "secondary",
  size = "md",
  className = ""
}: {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  className?: string;
} = {}) {
  return [
    "inline-flex items-center justify-center rounded-xl border font-semibold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

export function AppButton({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
}) {
  return <button className={appButtonClasses({ variant, size, className })} {...props} />;
}
