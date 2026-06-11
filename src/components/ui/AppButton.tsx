import React, { type ButtonHTMLAttributes } from "react";

type AppButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "quiet";
type AppButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary:
    "border-anime-cyan/80 bg-anime-cyan text-slate-950 shadow-anime-focus hover:bg-cyan-200 hover:shadow-[0_20px_70px_rgba(53,230,220,0.22)]",
  secondary:
    "border-anime-purple/35 bg-anime-purple/12 text-purple-100 hover:border-purple-200/60 hover:bg-anime-purple/20",
  danger:
    "border-anime-danger/35 bg-anime-danger/12 text-rose-100 hover:border-rose-200/60 hover:bg-anime-danger/20",
  ghost:
    "border-anime-border bg-white/[0.04] text-slate-100 hover:border-anime-cyan/35 hover:bg-white/[0.08]",
  quiet:
    "border-transparent bg-transparent text-slate-300 hover:border-anime-border hover:bg-white/[0.05] hover:text-white"
};

const SIZE_CLASS: Record<AppButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-3 text-sm"
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
    "inline-flex cursor-pointer items-center justify-center rounded-xl border font-semibold transition duration-anime active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
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
