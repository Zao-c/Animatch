import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong lobby navigation and clipboard parity", () => {
  const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");
  const share = readFileSync("src/components/anisong/SongShareButton.tsx", "utf8");

  it("uses real public, mine, and create routes instead of hash-based page sections", () => {
    expect(lobby).toContain('href: "/anisong"');
    expect(lobby).toContain('href: "/anisong/mine"');
    expect(lobby).toContain('href: "/anisong/create"');
    expect(lobby).not.toContain('href="#public-song-playlists"');
    expect(lobby).not.toContain('href="#my-song-playlists"');
    expect(lobby).not.toContain('href="#create-song-playlist"');
    expect(lobby).toContain('view === "public" ? <SongTemplateGallery />');
    expect(readFileSync("src/app/anisong/mine/page.tsx", "utf8")).toContain('view="mine"');
    expect(readFileSync("src/app/anisong/create/page.tsx", "utf8")).toContain('view="create"');
  });

  it("reuses the existing fallback copier for music playlist sharing", () => {
    expect(share).toContain('from "@/lib/browser-copy"');
    expect(share).toContain("copyTextWithFallback(url)");
    expect(share).not.toContain("navigator.clipboard?.writeText");
  });
});
