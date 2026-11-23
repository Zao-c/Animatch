"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getProxiedCoverCandidates, isDirectImageUrl, warmImageProxyCache } from "@/lib/image-proxy";

const SIZE_CLASS = {
  sm: "h-20 w-14",
  md: "h-36 w-24",
  lg: "aspect-[2/3] w-full sm:max-h-[420px]"
} as const;
const IMAGE_CANDIDATE_TIMEOUT_MS = 15000;
const FINAL_IMAGE_TIMEOUT_MS = 20000;
const DIRECT_IMAGE_TIMEOUT_MS = 15000;
const IMAGE_ERROR_RETRY_DELAY_MS = 2500;
const IMAGE_ERROR_RETRY_LIMIT = 2;

export function AnimeCover({
  src,
  secondarySrc,
  title,
  size = "md",
  fit = "cover",
  className = "",
  animeId,
  loading = "lazy",
  warm = false
}: {
  src: string | null | undefined;
  secondarySrc?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
  fit?: "cover" | "contain";
  className?: string;
  animeId?: string;
  loading?: "eager" | "lazy";
  warm?: boolean;
}) {
  const candidates = useMemo(() => buildImageCandidates(src, secondarySrc), [src, secondarySrc]);
  const [state, setState] = useState<"loading" | "loaded" | "error" | "empty">(
    candidates.length > 0 ? "loading" : "empty"
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(loading === "eager");

  // Native lazy images can wait offscreen indefinitely. Their network timeout
  // must not start until the browser has a reason to request them.
  useEffect(() => {
    if (loading === "eager" || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    setCandidateIndex(0);
    setRetryAttempt(0);
    setState(candidates.length > 0 ? "loading" : "empty");
  }, [candidates, animeId]);

  useEffect(() => {
    if (!warm || !isNearViewport) return;
    warmImageProxyCache(src);
    warmImageProxyCache(secondarySrc);
  }, [src, secondarySrc, warm, isNearViewport]);

  const imageSrc = candidates[candidateIndex] ?? null;

  useEffect(() => {
    if (state !== "loading" || !isNearViewport || candidates.length === 0 || imageSrc === null) {
      return;
    }

    const hasNextCandidate = candidateIndex < candidates.length - 1;
    const timeoutMs = isDirectImageUrl(imageSrc)
      ? DIRECT_IMAGE_TIMEOUT_MS
      : hasNextCandidate
        ? IMAGE_CANDIDATE_TIMEOUT_MS
        : FINAL_IMAGE_TIMEOUT_MS;
    const timeout = window.setTimeout(
      () => {
        if (hasNextCandidate) {
          setCandidateIndex((current) => Math.min(current + 1, candidates.length - 1));
          setState("loading");
        } else {
          setState("error");
        }
      },
      timeoutMs
    );

    return () => window.clearTimeout(timeout);
  }, [candidateIndex, candidates.length, imageSrc, state, isNearViewport]);

  useEffect(() => {
    if (state !== "error" || candidates.length === 0 || retryAttempt >= IMAGE_ERROR_RETRY_LIMIT) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCandidateIndex(0);
      setRetryAttempt((current) => current + 1);
      setState("loading");
    }, IMAGE_ERROR_RETRY_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [candidates.length, retryAttempt, state]);

  // Keep a slow image mounted so a late successful load can still recover.
  const shouldShowImage = Boolean(imageSrc) && state !== "empty";
  const coverState: "loading" | "loaded" | "error" | "empty" =
    candidates.length === 0 ? "empty" : state;
  const isCoverUnavailable = coverState === "error" || coverState === "empty";

  const imageFitClass =
    fit === "contain"
      ? "object-contain bg-slate-950"
      : "object-cover";

  return (
    <div
      ref={containerRef}
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
      data-cover-fit={fit}
      data-cover-state={coverState}
      data-cover-url-present={String(candidates.length > 0)}
      data-cover-candidate-count={candidates.length}
      data-anime-id={animeId ?? ""}
      title={isCoverUnavailable ? "封面加载失败，刷新页面或稍后再试。" : undefined}
      aria-label={isCoverUnavailable ? `${title}：封面加载失败，刷新页面或稍后再试。` : undefined}
    >
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-cyan-900/30 via-zinc-900 to-purple-900/20 p-3">
        <span className="text-lg font-bold text-cyan-400/60">
          {title.charAt(0).toUpperCase() || "A"}
        </span>
        {size !== "sm" && (
          <>
            <span className="text-center text-[10px] font-semibold leading-tight text-zinc-400">
              {isCoverUnavailable ? "封面加载失败" : ""}
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-zinc-500">
              {isCoverUnavailable ? "刷新页面或稍后再试" : ""}
            </span>
            <span className="line-clamp-1 text-center text-[10px] font-medium leading-tight text-zinc-600">
              {isCoverUnavailable ? title : ""}
            </span>
          </>
        )}
      </div>
      {isCoverUnavailable && size === "sm" ? (
        <span
          className="absolute right-1 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full border border-amber-200/50 bg-slate-950/85 text-[10px] font-black leading-none text-amber-100"
          aria-hidden="true"
        >
          !
        </span>
      ) : null}

      {shouldShowImage && (
        <img
          key={`${imageSrc}-${retryAttempt}`}
          src={imageSrc ?? ""}
          alt={title}
          loading={isNearViewport ? "eager" : loading}
          decoding="async"
          referrerPolicy="no-referrer"
          data-export-secondary-src={secondarySrc ?? undefined}
          data-cover-candidate-index={candidateIndex}
          className={`relative z-10 h-full w-full ${imageFitClass} transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => {
            setState("loaded");
            if (warm) warmImageProxyCache(imageSrc);
          }}
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
  return getProxiedCoverCandidates(rawPrimary, rawSecondary);
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
