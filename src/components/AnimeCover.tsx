"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";

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
  fit = "cover",
  className = ""
}: {
  src: string | null | undefined;
  secondarySrc?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [secondaryFailed, setSecondaryFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setSecondaryFailed(false);
  }, [src, secondarySrc]);

  const imageSrc = !failed
    ? src ?? (secondaryFailed ? null : secondarySrc ?? null)
    : secondaryFailed
      ? null
      : secondarySrc ?? null;
  const shouldShowImage = Boolean(imageSrc);
  const imageFitClass =
    fit === "contain"
      ? "object-contain bg-slate-950"
      : "object-cover";

  return (
    <div
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
      data-cover-fit={fit}
    >
      {shouldShowImage ? (
        <img
          src={imageSrc ?? ""}
          alt={title}
          referrerPolicy="no-referrer"
          data-export-secondary-src={secondarySrc ?? undefined}
          className={`h-full w-full ${imageFitClass}`}
          onError={() => {
            if (!failed) {
              setFailed(true);
            } else {
              setSecondaryFailed(true);
            }
          }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-cyan-900/30 via-zinc-900 to-purple-900/20 p-3">
          <span className="text-lg font-bold text-cyan-400/60">
            {title.charAt(0).toUpperCase() || "A"}
          </span>
          {size !== "sm" && (
            <>
              <span className="text-center text-[10px] font-semibold leading-tight text-zinc-400">
                图片暂时无法加载
              </span>
              <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-zinc-500">
                {title}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
