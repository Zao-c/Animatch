/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle, getAnimeImageFitMode } from "@/lib/anime-display";
import type { TierListItem } from "@/lib/client-api";
import { DEFAULT_TIER_LABELS, type TierLabels } from "@/lib/tier-labels";

const EXPORT_TIERS = ["S", "A", "B", "C", "D"] as const;
type ExportTier = (typeof EXPORT_TIERS)[number];

const TIER_LABEL_CLASS: Record<ExportTier, string> = {
  S: "tiermaker-label-s",
  A: "tiermaker-label-a",
  B: "tiermaker-label-b",
  C: "tiermaker-label-c",
  D: "tiermaker-label-d"
};

export type TierExportCanvasTiers = Record<ExportTier, TierListItem[]>;

export function TierExportCanvas({
  tiers,
  labels = DEFAULT_TIER_LABELS,
  failedImageIds = new Set<string>()
}: {
  tiers: TierExportCanvasTiers;
  labels?: TierLabels;
  failedImageIds?: ReadonlySet<string>;
}) {
  return (
    <div data-testid="tier-export-canvas" className="tiermaker-export-canvas">
      <div className="tiermaker-export-logo">AniMatch Tier Wall</div>
      <div className="tiermaker-export-board">
        {EXPORT_TIERS.map((tier) => (
          <div key={tier} className="tiermaker-export-row">
            <div className={`tiermaker-export-label ${TIER_LABEL_CLASS[tier]}`}>
              <span
                className={`tiermaker-export-label-text ${
                  labels[tier].length > 2 ? "tiermaker-export-label-long" : ""
                }`}
              >
                {labels[tier]}
              </span>
            </div>
            <div className="tiermaker-export-items">
              {tiers[tier].map((item) => (
                <TierExportItem
                  key={item.animeId}
                  item={item}
                  initiallyFailed={failedImageIds.has(item.animeId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="tiermaker-export-watermark">animatch</div>
    </div>
  );
}

function TierExportItem({
  item,
  initiallyFailed
}: {
  item: TierListItem;
  initiallyFailed: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(initiallyFailed);
  const title = getAnimeDisplayTitle(item);
  const coverUrl = getAnimeCoverUrl(item, { intent: "export" });
  const useContain = getAnimeImageFitMode(item) === "contain";
  const fallback = title.trim().slice(0, 1).toUpperCase() || "A";

  return (
    <div className="tiermaker-export-item" aria-label={title}>
      {coverUrl && !imageFailed ? (
        <img
          className={`tiermaker-export-image ${useContain ? "tiermaker-export-image-contain" : ""}`}
          src={coverUrl}
          alt=""
          referrerPolicy="no-referrer"
          data-tier-export-image="true"
          data-anime-id={item.animeId}
          onError={() => {
            console.warn("Tier export cover failed to load", {
              animeId: item.animeId,
              coverUrl
            });
            setImageFailed(true);
          }}
        />
      ) : (
        <div className="tiermaker-export-fallback">{fallback}</div>
      )}
    </div>
  );
}
