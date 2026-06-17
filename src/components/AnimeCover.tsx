"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useState } from "react";
import { proxyExternalImageUrl } from "@/lib/image-proxy";

const SIZE_CLASS = {
  sm: "h-20 w-14",
  md: "h-36 w-24",
  lg: "aspect-[2/3] w-full sm:max-h-[420px]"
} as const;
const IMAGE_CANDIDATE_TIMEOUT_MS = 2000;
const FINAL_IMAGE_TIMEOUT_MS = 6000;

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
  const candidates = useMemo(() => buildImageCandidates(src, secondarySrc), [src, secondarySrc]);
  const [state, setState] = useState<"loading" | "loaded" | "error" | "empty">(
    candidates.length > 0 ? "loading" : "empty"
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
    setState(candidates.length > 0 ? "loading" : "empty");
  }, [candidates, animeId]);

  const imageSrc = candidates[candidateIndex] ?? null;

  useEffect(() => {
    if (state !== "loading" || candidates.length === 0 || imageSrc === null) {
      return;
    }

    const hasNextCandidate = candidateIndex < candidates.length - 1;
    const timeout = window.setTimeout(
      () => {
        if (hasNextCandidate) {
          setCandidateIndex((current) => Math.min(current + 1, candidates.length - 1));
          setState("loading");
        } else {
          setState("error");
        }
      },
      hasNextCandidate ? IMAGE_CANDIDATE_TIMEOUT_MS : FINAL_IMAGE_TIMEOUT_MS
    );

    return () => window.clearTimeout(timeout);
  }, [candidateIndex, candidates.length, imageSrc, state]);

  const shouldShowImage = Boolean(imageSrc) && state !== "empty" && state !== "error";
  const coverState: "loading" | "loaded" | "error" | "empty" =
    candidates.length === 0 ? "empty" : state;

  const imageFitClass =
    fit === "contain"
      ? "object-contain bg-slate-950"
      : "object-cover";

  return (
    <div
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
      data-cover-fit={fit}
      data-cover-state={coverState}
      data-cover-url-present={String(candidates.length > 0)}
      data-cover-candidate-count={candidates.length}
      data-anime-id={animeId ?? ""}
    >
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-cyan-900/30 via-zinc-900 to-purple-900/20 p-3">
        <span className="text-lg font-bold text-cyan-400/60">
          {title.charAt(0).toUpperCase() || "A"}
        </span>
        {size !== "sm" && (
          <>
            <span className="text-center text-[10px] font-semibold leading-tight text-zinc-400">
              {coverState === "error" || coverState === "empty" ? "封面暂不可用" : ""}
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-zinc-500">
              {coverState === "error" || coverState === "empty" ? title : ""}
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
          data-cover-candidate-index={candidateIndex}
          className={`relative z-10 h-full w-full ${imageFitClass} transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setState("loaded")}
          onError={() => {
            if (candidateIndex < candidates.length - 1) {
              setCandidateIndex((current) => current + 1);
              setState("loading");
            } else {
              setState("error");
            }
          }}
        />
      )}
    </div>
  );
}

function buildImageCandidates(
  primary: string | null | undefined,
  secondary: string | null | undefined
): string[] {
  const rawPrimary = normalizeImageUrl(primary);
  const rawSecondary = normalizeImageUrl(secondary);
  const values = [
    proxyExternalImageUrl(rawPrimary),
    rawPrimary,
    proxyExternalImageUrl(rawSecondary),
    rawSecondary
  ];
  const seen = new Set<string>();

  return values.flatMap((value) => {
    if (value === null) return [];
    if (seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
