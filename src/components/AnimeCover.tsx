"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";

const SIZE_CLASS = {
  sm: "h-20 w-14",
  md: "h-36 w-24",
  lg: "aspect-[2/3] w-full sm:max-h-[420px]"
} as const;

export function AnimeCover({
  src,
  secondarySrc,
  title,
  size = "md",
  fit = "cover",
  className = "",
  animeId
}: {
  src: string | null | undefined;
  secondarySrc?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
  fit?: "cover" | "contain";
  className?: string;
  animeId?: string;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error" | "empty">("loading");
  const [secondaryFailed, setSecondaryFailed] = useState(false);

  useEffect(() => {
    setState("loading");
    setSecondaryFailed(false);
  }, [src, secondarySrc, animeId]);

  const imageSrc = state !== "error"
    ? src ?? (secondaryFailed ? null : secondarySrc ?? null)
    : secondaryFailed
      ? null
      : secondarySrc ?? null;
  const shouldShowImage = Boolean(imageSrc);
  const coverUrlPresent = shouldShowImage;
  const coverState: "loading" | "loaded" | "error" | "empty" =
    shouldShowImage ? state : "empty";

  const imageFitClass =
    fit === "contain"
      ? "object-contain bg-slate-950"
      : "object-cover";

  return (
    <div
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
      data-cover-fit={fit}
      data-cover-state={coverState}
      data-cover-url-present={String(shouldShowImage)}
      data-anime-id={animeId ?? ""}
    >
      {/* Skeleton / fallback layer：always visible */}
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-cyan-900/30 via-zinc-900 to-purple-900/20 p-3">
        <span className="text-lg font-bold text-cyan-400/60">
          {title.charAt(0).toUpperCase() || "A"}
        </span>
        {size !== "sm" && (
          <>
            <span className="text-center text-[10px] font-semibold leading-tight text-zinc-400">
              {shouldShowImage ? "" : "封面暂不可用"}
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-zinc-500">
              {shouldShowImage ? "" : title}
            </span>
          </>
        )}
      </div>

      {shouldShowImage && (
        <img
          src={imageSrc ?? ""}
          alt={title}
          loading="eager"
          referrerPolicy="no-referrer"
          data-export-secondary-src={secondarySrc ?? undefined}
          className={`relative z-10 h-full w-full ${imageFitClass} transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setState("loaded")}
          onError={() => {
            if (state === "loading") {
              setState("error");
            } else {
              setSecondaryFailed(true);
            }
          }}
        />
      )}
    </div>
  );
}
