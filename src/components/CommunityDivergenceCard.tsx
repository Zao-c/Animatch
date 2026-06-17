"use client";

import React from "react";
import { AnimeCover } from "./AnimeCover";
import { AppCard } from "./ui/AppCard";
import type { DivergenceResult, DivergenceItem } from "@/lib/community-divergence";

export function CommunityDivergenceCard({
  result,
  className = ""
}: {
  result: DivergenceResult;
  className?: string;
}) {
  if (result.insufficientCommunity) {
    return null;
  }

  if (result.insufficientPersonal) {
    return (
      <AppCard className={`p-5 ${className}`} variant="soft">
        <h2 className="text-lg font-semibold text-white">
          你和社区的最大分歧
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          先完成几轮对决，再看你和社区的分歧。
        </p>
      </AppCard>
    );
  }

  const hasDivergence =
    result.userLikesMore !== null ||
    result.userLikesLess !== null ||
    result.mostAligned !== null;

  if (!hasDivergence) {
    return (
      <AppCard className={`p-5 ${className}`} variant="soft">
        <h2 className="text-lg font-semibold text-white">
          你和社区的最大分歧
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          你和社区口味很接近。
        </p>
      </AppCard>
    );
  }

  return (
    <AppCard className={`p-5 ${className}`} variant="soft">
      <h2 className="text-lg font-semibold text-white">
        你和社区的最大分歧
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        看看你的口味和大家差在哪。
        {result.userLikesMore !== null && result.userLikesMore.participantCount < 3
          ? " 社区样本还少，这只是试玩参考。"
          : ""}
      </p>

      <div className="mt-5 space-y-4">
        {result.userLikesMore !== null ? (
          <DivergenceRow
            item={result.userLikesMore}
            type="likes-more"
          />
        ) : null}

        {result.userLikesLess !== null ? (
          <DivergenceRow
            item={result.userLikesLess}
            type="likes-less"
          />
        ) : null}

        {result.mostAligned !== null ? (
          <DivergenceRow
            item={result.mostAligned}
            type="aligned"
          />
        ) : null}
      </div>
    </AppCard>
  );
}

function DivergenceRow({
  item,
  type
}: {
  item: DivergenceItem;
  type: "likes-more" | "likes-less" | "aligned";
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="h-20 w-14 shrink-0">
        <AnimeCover
          src={item.imageUrl}
          title={item.title}
          size="sm"
          fit="cover"
          animeId={item.animeId}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-bold text-white">
          {item.title}
        </h3>
        {type === "aligned" ? (
          <p className="mt-1.5 text-xs leading-5 text-slate-300">
            你和社区都把它放在{" "}
            <span className="font-semibold text-purple-200">
              {item.personalTierLabel}
            </span>{" "}
            附近。
            <br />
            你们最一致。
          </p>
        ) : type === "likes-more" ? (
          <p className="mt-1.5 text-xs leading-5 text-slate-300">
            你把它排在{" "}
            <span className="font-semibold text-cyan-200">
              {item.personalTierLabel}
            </span>
            ，社区平均在{" "}
            <span className="font-semibold text-amber-200">
              {item.communityTierLabel}
            </span>
            。
            <br />
            你比社区更喜欢它。
          </p>
        ) : (
          <p className="mt-1.5 text-xs leading-5 text-slate-300">
            社区把它排在{" "}
            <span className="font-semibold text-amber-200">
              {item.communityTierLabel}
            </span>
            ，你只排在{" "}
            <span className="font-semibold text-cyan-200">
              {item.personalTierLabel}
            </span>
            。
            <br />
            你比社区更不喜欢它。
          </p>
        )}
      </div>
    </div>
  );
}
