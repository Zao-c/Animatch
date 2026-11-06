/* eslint-disable @next/next/no-img-element */
import React, { useMemo, useState } from "react";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle, getAnimeImageFitMode } from "@/lib/anime-display";
import { proxyExternalImageUrl } from "@/lib/image-proxy";
import { smartCoverUrl } from "@/lib/smart-cover-url";
import type { TierListItem, TierRowConfig } from "@/lib/client-api";
import { DEFAULT_TIER_CONFIG } from "@/lib/tier-config";

const TIER_LABEL_CLASS_KEYS = [
  "tiermaker-label-s",
  "tiermaker-label-a",
  "tiermaker-label-b",
  "tiermaker-label-c",
  "tiermaker-label-d",
  "tiermaker-label-e",
  "tiermaker-label-f"
];

export type TierExportCanvasTiers = Record<string, TierListItem[]>;

export function TierExportCanvas({
  tiers,
  tierRows,
  failedImageIds = new Set<string>()
}: {
  tiers: TierExportCanvasTiers;
  tierRows?: TierRowConfig[];
  failedImageIds?: ReadonlySet<string>;
}) {
  const rows = tierRows ?? DEFAULT_TIER_CONFIG.rows;

  return (
    <div data-testid="tier-export-canvas" className="tiermaker-export-canvas">
      <div className="tiermaker-export-logo">AniMatch Tier Wall</div>
      <div className="tiermaker-export-board">
        {rows.map((row, idx) => {
          const labelClass = TIER_LABEL_CLASS_KEYS[idx % TIER_LABEL_CLASS_KEYS.length];
          const rowItems = tiers[row.id] ?? [];
          return (
            <div key={row.id} className="tiermaker-export-row">
              <div
                className={`tiermaker-export-label ${labelClass}`}
                style={{ backgroundColor: row.color }}
              >
                <span
                  className={`tiermaker-export-label-text ${
                    row.label.length > 2 ? "tiermaker-export-label-long" : ""
                  }`}
                >
                  {row.label}
                </span>
              </div>
              <div className="tiermaker-export-items">
                {rowItems.map((item) => (
                  <TierExportItem
                    key={item.animeId}
                    item={item}
                    initiallyFailed={failedImageIds.has(item.animeId)}
                  />
                ))}
              </div>
            </div>
          );
        })}
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
  const [useOriginal, setUseOriginal] = useState(false);
  const title = getAnimeDisplayTitle(item);
  const rawCoverUrl = getAnimeCoverUrl(item, { intent: "export" });
  const smartUrl = smartCoverUrl(rawCoverUrl, item.source, "tier");
  const originalUrl = useMemo(() => proxyExternalImageUrl(rawCoverUrl), [rawCoverUrl]);
  const coverUrl = useOriginal ? originalUrl : proxyExternalImageUrl(smartUrl);
  const useContain = getAnimeImageFitMode(item) === "contain" && (useOriginal || smartUrl === rawCoverUrl);
  const fallback = title.trim().slice(0, 1).toUpperCase() || "A";

  React.useEffect(() => {
    setImageFailed(initiallyFailed);
    setUseOriginal(false);
  }, [initiallyFailed, rawCoverUrl]);

  return (
    <div className="tiermaker-export-item" aria-label={title}>
      {coverUrl && !imageFailed ? (
        <img
          className={`tiermaker-export-image ${useContain ? "tiermaker-export-image-contain" : ""}`}
          src={coverUrl}
          loading="eager"
          alt=""
          referrerPolicy="no-referrer"
          data-tier-export-image="true"
          data-anime-id={item.animeId}
          onError={() => {
            if (!useOriginal && smartUrl !== rawCoverUrl && originalUrl) {
              setUseOriginal(true);
              return;
            }
            console.warn("Tier export cover failed to load", { animeId: item.animeId, coverUrl });
            setImageFailed(true);
          }}
        />
      ) : (
        <div className="tiermaker-export-fallback">{fallback}</div>
      )}
    </div>
  );
}
