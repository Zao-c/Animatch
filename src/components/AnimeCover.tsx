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
  title,
  size = "md",
  className = ""
}: {
  src: string | null | undefined;
  title: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const shouldShowImage = Boolean(src) && !failed;
  const imageSrc = src ?? "";

  return (
    <div
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-zinc-900 ${className}`}
    >
      {shouldShowImage ? (
        <Image
          src={imageSrc}
          alt={title}
          fill
          sizes={size === "lg" ? "(max-width: 768px) 90vw, 38vw" : "160px"}
          className="object-cover"
          onError={() => setFailed(true)}
          priority={size === "lg"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-900 p-3 text-center text-xs font-medium leading-5 text-zinc-400">
          {title}
        </div>
      )}
    </div>
  );
}
