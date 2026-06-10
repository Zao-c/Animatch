"use client";

import Image from "next/image";
import { useState } from "react";

const SIZE_CLASS = {
  sm: "h-20 w-14",
  md: "h-36 w-24",
  lg: "h-[420px] w-full"
} as const;

export function AnimeCover({
  src,
  secondarySrc,
  title,
  size = "md",
  className = ""
}: {
  src: string | null | undefined;
  secondarySrc?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [secondaryFailed, setSecondaryFailed] = useState(false);

  const imageSrc = !failed
    ? src ?? (secondaryFailed ? null : secondarySrc ?? null)
    : secondaryFailed
      ? null
      : secondarySrc ?? null;
  const shouldShowImage = Boolean(imageSrc);

  return (
    <div
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
    >
      {shouldShowImage ? (
        <Image
          src={imageSrc ?? ""}
          alt={title}
          fill
          sizes={size === "lg" ? "(max-width: 768px) 90vw, 38vw" : "160px"}
          className="object-cover"
          onError={() => {
            if (!failed) {
              setFailed(true);
            } else {
              setSecondaryFailed(true);
            }
          }}
          priority={size === "lg"}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-cyan-900/30 via-zinc-900 to-purple-900/20 p-3">
          <span className="text-lg font-bold text-cyan-400/60">
            {title.charAt(0).toUpperCase() || "A"}
          </span>
          {size !== "sm" && (
            <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-zinc-500">
              {title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
