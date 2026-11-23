"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCoverDeliveryCandidates } from "@/lib/image-proxy";
import { forgetCoverSource, loadCoverImage, rememberedCover, retryCoverSources } from "@/lib/cover-loader";

const SIZE_CLASS = { sm: "h-20 w-14", md: "h-36 w-24", lg: "aspect-[2/3] w-full sm:max-h-[420px]" } as const;
type CoverProps = {
  src: string | null | undefined;
  secondarySrc?: string | null;
  fallbackSrcs?: readonly string[];
  title: string;
  size?: "sm" | "md" | "lg";
  fit?: "cover" | "contain";
  className?: string;
  animeId?: string;
  loading?: "eager" | "lazy";
  warm?: boolean;
};

export function AnimeCover(props: CoverProps) {
  const sources = getCoverDeliveryCandidates(props.src, props.secondarySrc, props.fallbackSrcs);
  const sourceKey = JSON.stringify(sources);
  // Reusing a card for another source must never reuse its success/error state.
  return <CoverImage key={`${props.animeId ?? ""}|${sourceKey}`} {...props} sourceKey={sourceKey} />;
}

function CoverImage({ sourceKey, secondarySrc, title, size = "md", fit = "cover", className = "", animeId, loading = "lazy", warm = false }: CoverProps & { sourceKey: string }) {
  const candidates = useMemo<string[]>(() => JSON.parse(sourceKey), [sourceKey]);
  const [imageSrc, setImageSrc] = useState(() => rememberedCover(candidates));
  const [state, setState] = useState<"loading" | "loaded" | "error" | "empty">(candidates.length ? "loading" : "empty");
  const [retryAttempt, setRetryAttempt] = useState(0), [retryToken, setRetryToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null), imageRef = useRef<HTMLImageElement>(null);
  const priority = useRef(0);
  const [isNearViewport, setIsNearViewport] = useState(loading === "eager");
  const retry = () => { retryCoverSources(candidates); setRetryAttempt(0); setState("loading"); setRetryToken((n) => n + 1); };

  useEffect(() => {
    if (loading === "eager" || typeof IntersectionObserver === "undefined") { setIsNearViewport(true); return; }
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        priority.current = entry.boundingClientRect.top < window.innerHeight && entry.boundingClientRect.bottom > 0 ? 0 : 1;
        setIsNearViewport(entry.isIntersecting);
      }
    }, { rootMargin: "200px" });
    observer.observe(element); return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (!isNearViewport || !candidates.length) return;
    const cached = rememberedCover(candidates);
    if (cached) { setImageSrc(cached); setState("loaded"); return; }
    const controller = new AbortController();
    setState("loading");
    void loadCoverImage(candidates, { signal: controller.signal, priority: loading === "eager" || warm ? 0 : priority.current })
      .then((source) => { if (!controller.signal.aborted) { setImageSrc(source); setState("loaded"); } })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [candidates, isNearViewport, retryToken, loading, warm]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setState("loaded");
  }, [imageSrc]);

  useEffect(() => {
    if (state !== "error" || !isNearViewport || retryAttempt >= 3) return;
    const timer = window.setTimeout(() => { setRetryAttempt((n) => n + 1); setRetryToken((n) => n + 1); }, 12000 * (retryAttempt + 1));
    return () => window.clearTimeout(timer);
  }, [state, isNearViewport, retryAttempt]);
  useEffect(() => {
    if (state !== "error" || !isNearViewport) return;
    const recover = () => { retryCoverSources(candidates); setRetryToken((n) => n + 1); };
    window.addEventListener("online", recover); window.addEventListener("focus", recover);
    return () => { window.removeEventListener("online", recover); window.removeEventListener("focus", recover); };
  }, [state, isNearViewport, candidates]);

  // Omit src until scheduled: native eager loads would bypass the bounded queue.
  const shouldShowImage = candidates.length > 0;
  const candidateIndex = imageSrc ? candidates.indexOf(imageSrc) : 0;
  const coverState = candidates.length ? state : "empty";
  const isCoverUnavailable = coverState === "error" || coverState === "empty";
  const imageFitClass = fit === "contain" ? "object-contain bg-slate-950" : "object-cover";
  return (
    <div
      ref={containerRef}
      onClickCapture={isCoverUnavailable && candidates.length ? () => retry() : undefined}
      className={`${SIZE_CLASS[size]} relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
      data-cover-fit={fit}
      data-cover-state={coverState}
      data-cover-url-present={String(candidates.length > 0)}
      data-cover-candidate-count={candidates.length}
      data-anime-id={animeId ?? ""}
      title={coverState === "empty" ? "暂无封面" : isCoverUnavailable ? "封面暂时不可用，会自动重试，不影响选择作品。" : undefined}
      aria-label={isCoverUnavailable ? `${title}：${coverState === "empty" ? "暂无封面" : "封面暂时不可用"}` : undefined}
    >
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-cyan-900/30 via-zinc-900 to-purple-900/20 p-3">
        <span className="text-lg font-bold text-cyan-400/60">
          {title.charAt(0).toUpperCase() || "A"}
        </span>
        {size !== "sm" && (
          <>
            <span className="text-center text-[10px] font-semibold leading-tight text-zinc-400">
              {coverState === "empty" ? "暂无封面" : isCoverUnavailable ? "封面暂不可用" : ""}
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-zinc-500">
              {coverState === "error" ? "稍后自动重试" : ""}
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
          ref={imageRef}
          key={imageSrc ?? "pending"}
          src={imageSrc ?? undefined}
          data-cover-primary-src={candidates[0]}
          data-export-src={imageSrc ?? candidates[0]}
          alt={title}
          loading={isNearViewport ? "eager" : loading}
          decoding="async"
          referrerPolicy="no-referrer"
          data-export-secondary-src={secondarySrc ?? undefined}
          data-export-fallback-srcs={JSON.stringify(candidates)}
          data-cover-candidate-index={candidateIndex}
          className={`relative z-10 h-full w-full ${imageFitClass} transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setState("loaded")}
          onError={() => {
            if (imageSrc) {
              forgetCoverSource(imageSrc);
              setImageSrc(undefined);
              setRetryToken((value) => value + 1);
            }
            setState("error");
          }}
        />
      )}
    </div>
  );
}
