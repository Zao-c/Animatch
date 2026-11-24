import React from "react";

export function ErrorAlert({
  message,
  tone = "error",
  className = ""
}: {
  message: string;
  tone?: "error" | "notice" | "warning";
  className?: string;
}) {
  const toneClass =
    tone === "notice"
      ? "border-white/15 bg-white/[0.06] text-zinc-100"
      : tone === "warning"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-rose-400/25 bg-rose-500/10 text-rose-100";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-2xl border px-4 py-3 text-sm ${toneClass} ${className}`}
    >
      {message}
    </div>
  );
}
