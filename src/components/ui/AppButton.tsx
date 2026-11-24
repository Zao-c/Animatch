import React, { type ButtonHTMLAttributes } from "react";

type AppButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "quiet";
type AppButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary:
    "border-zinc-100 bg-zinc-100 text-zinc-950 hover:border-white hover:bg-white",
  secondary:
    "border-white/15 bg-white/[0.06] text-zinc-100 hover:border-white/25 hover:bg-white/[0.11]",
  danger:
    "border-rose-500/30 bg-rose-500/12 text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/20",
  ghost:
    "border-white/10 bg-transparent text-zinc-200 hover:border-white/25 hover:bg-white/[0.06] hover:text-white",
  quiet:
    "border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-zinc-100"
};

const SIZE_CLASS: Record<AppButtonSize, string> = {
  sm: "min-h-11 px-3 py-2 text-xs",
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
