"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import {
  createDemoPool,
  getDashboard,
  type MiniMatchPreview,
  type MiniMatchPreviewAnime
} from "@/lib/client-api";

type Choice = "left" | "right" | "draw" | null;

export function HomeMiniMatchDemo() {
  const [preview, setPreview] = useState<MiniMatchPreview | null>(null);
  const [pairIndex, setPairIndex] = useState(0);
  const [choice, setChoice] = useState<Choice>(null);
  const [isPreparingDemoPool, setIsPreparingDemoPool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choiceAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDashboard()
      .then((data) => {
        if (!cancelled) {
          setPreview(data.miniMatchPreview);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ source: "EMPTY", ctaLabel: "体验示例番组", pairs: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (choiceAdvanceTimerRef.current !== null) {
        window.clearTimeout(choiceAdvanceTimerRef.current);
      }
    };
  }, []);

  const pair = useMemo(() => {
    if (preview === null || preview.pairs.length === 0) return null;
    return preview.pairs[pairIndex % preview.pairs.length];
  }, [pairIndex, preview]);

  function choose(nextChoice: Exclude<Choice, null>) {
    if (preview === null || preview.pairs.length === 0 || choice !== null) return;
    setChoice(nextChoice);
    choiceAdvanceTimerRef.current = window.setTimeout(() => {
      choiceAdvanceTimerRef.current = null;
      setChoice(null);
      setPairIndex((current) => (current + 1) % preview.pairs.length);
    }, 500);
  }

  async function handleDemoPool() {
    setIsPreparingDemoPool(true);
    setError(null);

    try {
      const result = await createDemoPool();
      window.location.assign(result.redirectTo);
    } catch {
      setError("示例番组创建失败，请稍后重试。");
    } finally {
      setIsPreparingDemoPool(false);
    }
  }

  if (preview === null) {
    return (
      <AppCard variant="focus" className="min-w-0 p-5" aria-label="mini match demo">
        <h2 className="text-sm font-semibold text-zinc-300">对决预览</h2>
        <p className="mt-2 text-xs text-zinc-500">正在加载…</p>
      </AppCard>
    );
  }

  if (pair === null) {
    return (
      <AppCard variant="focus" className="min-w-0 p-5" aria-label="mini match demo empty">
        <h2 className="text-base font-bold text-white">对决预览</h2>
        <p className="mt-1.5 text-sm text-zinc-400">选一个公开番组即可开始。</p>
        <AppButton
          type="button"
          className="mt-4 w-full"
          variant="primary"
          onClick={handleDemoPool}
          disabled={isPreparingDemoPool}
        >
          {isPreparingDemoPool ? "正在准备体验池..." : "体验示例番组"}
        </AppButton>
        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      </AppCard>
    );
  }

  const wall = preview.pairs.flatMap((item) => [item.left, item.right]).slice(0, 8);

  return (
    <AppCard variant="focus" className="min-w-0 p-4 sm:p-5" aria-label="mini match demo">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <h2 className="text-sm font-semibold text-zinc-100">对决预览</h2>
        <span className="text-xs font-medium text-zinc-500">
          {pairIndex + 1} / {preview.pairs.length}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] sm:gap-3">
        <PreviewCard anime={pair.left} side="left" choice={choice} onPick={() => choose("left")} disabled={choice !== null} />
        <div className="flex h-full items-center justify-center pt-10 text-[11px] font-black tracking-[0.18em] text-zinc-500">VS</div>
        <PreviewCard anime={pair.right} side="right" choice={choice} onPick={() => choose("right")} disabled={choice !== null} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ChoiceButton label="左边" ariaLabel={`更喜欢${pair.left.titleCn ?? pair.left.title}`} onClick={() => choose("left")} active={choice === "left"} disabled={choice !== null} />
        <ChoiceButton label="差不多" ariaLabel="两部同样喜欢" onClick={() => choose("draw")} active={choice === "draw"} disabled={choice !== null} />
        <ChoiceButton label="右边" ariaLabel={`更喜欢${pair.right.titleCn ?? pair.right.title}`} onClick={() => choose("right")} active={choice === "right"} disabled={choice !== null} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        {wall.length > 0 ? (
          <ul className="flex items-center gap-1" aria-label="试玩候补作品">
            {wall.slice(0, 6).map((anime, index) => {
              const title = anime.titleCn ?? anime.title;
              const isCurrent = anime.animeId === pair.left.animeId || anime.animeId === pair.right.animeId;
              return (
                <li key={`${anime.animeId}-${index}`} className={`transition duration-anime ${isCurrent ? "opacity-100" : "opacity-45"}`}>
                  <div className={`h-8 w-6 overflow-hidden rounded bg-[#0c0d10] ring-1 ${isCurrent ? "ring-zinc-200/80" : "ring-white/[0.08]"}`}>
                    <AnimeCover
                      src={anime.imageUrl}
                      title={title}
                      size="sm"
                      className="h-full w-full rounded-none border-0"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <span />}

        {preview.ctaHref ? (
          <Link href={preview.ctaHref} className={appButtonClasses({ variant: "ghost", size: "sm" })}>
            {preview.ctaLabel} →
          </Link>
        ) : (
          <AppButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDemoPool}
            disabled={isPreparingDemoPool}
          >
            {isPreparingDemoPool ? "正在准备..." : `${preview.ctaLabel} →`}
          </AppButton>
        )}
      </div>

      {error ? <p className="mt-3 text-center text-xs text-rose-300">{error}</p> : null}
    </AppCard>
  );
}

function PreviewCard({
  anime,
  side,
  choice,
  onPick,
  disabled
}: {
  anime: MiniMatchPreviewAnime;
  side: "left" | "right";
  choice: Choice;
  onPick: () => void;
  disabled: boolean;
}) {
  const title = anime.titleCn ?? anime.title;
  const selected = choice === side || choice === "draw";
  const dimmed =
    (choice === "left" && side === "right") || (choice === "right" && side === "left");

  return (
    <div className={`group min-w-0 transition duration-anime ${dimmed ? "opacity-40" : ""}`}>
      <div
        className={[
          "relative overflow-hidden rounded-xl bg-[#0c0d10] ring-1 transition duration-anime",
          selected ? "ring-2 ring-zinc-100" : "ring-white/[0.09] group-hover:ring-white/30"
        ].join(" ")}
      >
        <AnimeCover
          src={anime.imageUrl}
          title={title}
          size="md"
          className="aspect-[3/4] h-auto w-full rounded-none border-0 object-cover"
        />
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          aria-label={`选择${side === "left" ? "左边" : "右边"}：${title}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-wait"
        />
      </div>
      <p className="mt-1.5 line-clamp-1 text-center text-xs font-medium text-zinc-200" title={title}>{title}</p>
    </div>
  );
}

function ChoiceButton({
  label,
  ariaLabel,
  active,
  disabled,
  onClick
}: {
  label: string;
  ariaLabel: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        "min-h-10 rounded-lg border px-2 text-xs font-semibold transition duration-anime active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-zinc-100 bg-zinc-100 text-zinc-950"
          : "border-white/[0.09] bg-[#0c0d10]/60 text-zinc-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
      ].join(" ")}
    >
      {label}
    </button>
  );
}
