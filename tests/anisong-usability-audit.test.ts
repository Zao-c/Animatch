import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { songPlaybackPlan } from "@/lib/anisong/playback";
import type { SongTrack } from "@/lib/anisong/types";

const track = (source: SongTrack["source"], itunes?: SongTrack["itunes"]): SongTrack => ({
  id: "sample", title: "Sample", artist: "Artist", anime: "Anime", kind: "OP",
  year: 2026, quarter: 4, tags: [], clipStart: 0, clipLength: 30, source, itunes
});

describe("AniSong usability audit", () => {
  it("uses an existing provider even when a different provider is preferred and automatic failover is disabled", () => {
    const appleOnly = track({ kind: "itunes", id: "123", country: "JP" });
    expect(songPlaybackPlan(appleOnly, { preferred: "pool", fallback: false })).toEqual(["itunes"]);
    const poolOnly = track({ kind: "pool", assetId: "public" });
    expect(songPlaybackPlan(poolOnly, { preferred: "itunes", fallback: false })).toEqual(["pool"]);
  });

  it("only includes backup providers on actual failover when available", () => {
    const dual = track({ kind: "pool", assetId: "public" },
      { id: "123", country: "JP", title: "Sample", artist: "Artist", storeUrl: "https://music.apple.com/jp" });
    expect(songPlaybackPlan(dual, { preferred: "pool", fallback: false })).toEqual(["pool"]);
    expect(songPlaybackPlan(dual, { preferred: "pool", fallback: true })).toEqual(["pool", "itunes"]);
    expect(songPlaybackPlan(dual, { preferred: "itunes", fallback: false })).toEqual(["itunes"]);
  });

  it("does not leak page-retry work after unmount and scrolls to the persistent tab navigation", () => {
    const gallery = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
    const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
    expect(gallery).toContain("setRetryKey(value => value + 1)");
    expect(gallery).toContain("return () => controller.abort()");
    expect(gallery).not.toContain("const controller = new AbortController(); void load(controller.signal); }}>重试");
    expect(detail).toContain("pendingTabScroll.current = true");
    expect(detail).toContain('<DashboardTabs id="song-public"');
    expect(detail).toContain('aria-labelledby={`song-public-tab-${tab}`}');
  });
});
