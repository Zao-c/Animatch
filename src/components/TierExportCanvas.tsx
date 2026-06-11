/* eslint-disable @next/next/no-img-element */
import React from "react";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
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
  labels = DEFAULT_TIER_LABELS
}: {
  tiers: TierExportCanvasTiers;
  labels?: TierLabels;
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
                <TierExportItem key={item.animeId} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="tiermaker-export-watermark">animatch</div>
    </div>
  );
}

function TierExportItem({ item }: { item: TierListItem }) {
  const title = item.display?.title ?? item.titleCn ?? item.title;
  const coverUrl = getAnimeCoverUrl(item, { intent: "export" });
  const fallback = title.trim().slice(0, 1).toUpperCase() || "A";

  return (
    <div className="tiermaker-export-item" aria-label={title}>
      {coverUrl ? (
        <img className="tiermaker-export-image" src={coverUrl} alt="" />
      ) : (
        <div className="tiermaker-export-fallback">{fallback}</div>
      )}
    </div>
  );
}
