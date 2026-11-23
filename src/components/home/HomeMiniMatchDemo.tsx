"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { AppBadge } from "@/components/ui/AppBadge";
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
      <AppCard variant="focus" className="overflow-hidden p-5" aria-label="mini match demo">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">番剧擂台</p>
        <h2 className="mt-2 text-lg font-semibold text-white">正在准备真实对决预览...</h2>
      </AppCard>
    );
  }

  if (pair === null) {
    return (
      <AppCard variant="focus" className="overflow-hidden p-5" aria-label="mini match demo empty">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">番剧擂台</p>
            <h2 className="mt-2 text-xl font-black text-white">还没有可预览的对决</h2>
          </div>
          <AppBadge tone="warning">Preview</AppBadge>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          创建番组或体验示例番组后，这里会显示真实封面对决预览。
        </p>
        <AppButton
          type="button"
          className="mt-5 w-full"
          variant="primary"
          onClick={handleDemoPool}
          disabled={isPreparingDemoPool}
        >
          {isPreparingDemoPool ? "正在准备体验池..." : "体验示例番组"}
        </AppButton>
        {error ? <p className="mt-3 text-xs text-red-200">{error}</p> : null}
      </AppCard>
    );
  }

  return (
    <AppCard variant="focus" className="overflow-hidden p-4 sm:p-5" aria-label="mini match demo">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">番剧擂台</p>
          <h2 className="mt-1 text-lg font-semibold text-white">本轮你更想推荐哪部？</h2>
          <p className="mt-1 text-xs text-slate-400">体验预览，不会保存结果。</p>
        </div>
        <AppBadge tone="warning">VS</AppBadge>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-3">
        <PreviewCard anime={pair.left} side="left" choice={choice} />
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-anime-amber/35 bg-anime-amber/10 text-sm font-black text-amber-100 shadow-anime-amber">
          VS
        </div>
        <PreviewCard anime={pair.right} side="right" choice={choice} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ChoiceButton label="左边" onClick={() => choose("left")} active={choice === "left"} disabled={choice !== null} />
        <ChoiceButton label="差不多" onClick={() => choose("draw")} active={choice === "draw"} disabled={choice !== null} />
        <ChoiceButton label="右边" onClick={() => choose("right")} active={choice === "right"} disabled={choice !== null} />
      </div>

      {choice !== null ? (
        <p className="mt-3 text-center text-xs text-cyan-100">
          演示选择不会保存，进入对决页后才会记录结果。
        </p>
      ) : null}

      {preview.ctaHref ? (
        <Link
          href={preview.ctaHref}
          className={appButtonClasses({ variant: "primary", className: "mt-4 w-full" })}
        >
          {preview.ctaLabel}
        </Link>
      ) : (
        <AppButton
          type="button"
          className="mt-4 w-full"
          variant="primary"
          onClick={handleDemoPool}
          disabled={isPreparingDemoPool}
        >
          {isPreparingDemoPool ? "正在准备体验池..." : preview.ctaLabel}
        </AppButton>
      )}
      {error ? <p className="mt-3 text-xs text-red-200">{error}</p> : null}
    </AppCard>
  );
}

function PreviewCard({
  anime,
  side,
  choice
}: {
  anime: MiniMatchPreviewAnime;
  side: "left" | "right";
  choice: Choice;
}) {
  const title = anime.titleCn ?? anime.title;
  const selected = choice === side || choice === "draw";
  const dimmed =
    (choice === "left" && side === "right") || (choice === "right" && side === "left");

  return (
    <div className={`min-w-0 transition duration-anime ${dimmed ? "opacity-45" : ""}`}>
      <div
        className={[
          "overflow-hidden rounded-anime border bg-slate-950/70 transition duration-anime",
          selected
            ? "border-anime-pink/70 shadow-[0_0_28px_rgba(255,79,169,0.25)]"
            : "border-white/12"
        ].join(" ")}
      >
        <AnimeCover
          src={anime.imageUrl}
          title={title}
          size="lg"
          className="aspect-[3/4] h-auto w-full rounded-none border-0 object-cover"
        />
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-slate-400">
        {side === "left" ? "这边" : "那边"}
      </p>
    </div>
  );
}

function ChoiceButton({
  label,
  active,
  disabled,
  onClick
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "min-h-11 rounded-xl border px-2 text-sm font-semibold transition duration-anime active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70",
        active
          ? "border-anime-pink/55 bg-anime-pink/18 text-pink-50 shadow-[0_0_18px_rgba(255,79,169,0.16)]"
          : "border-anime-cyan/25 bg-anime-cyan/10 text-cyan-100 hover:bg-anime-cyan/16"
      ].join(" ")}
    >
      {label}
    </button>
  );
}
