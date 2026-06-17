import Link from "next/link";
import type { ComponentProps } from "react";

export function NavLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={[
        "inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium transition duration-anime",
        "border-white/10 bg-white/[0.04] text-slate-300",
        "hover:border-anime-purple/35 hover:bg-anime-purple/10 hover:text-white",
        "active:scale-[0.97]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
