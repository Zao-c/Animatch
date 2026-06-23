import Link from "next/link";
import type { ComponentProps } from "react";

export function NavLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={[
        "inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-xs font-medium transition duration-anime",
        "border-white/10 bg-white/[0.04] text-slate-300",
        "hover:border-anime-purple/35 hover:bg-anime-purple/10 hover:text-white",
        "active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-anime-cyan/40",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
