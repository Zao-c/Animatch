import { describe, expect, it } from "vitest";
import { preferredSongCover, songCoverCandidates } from "@/lib/anisong/cover-quality";

describe("AniSong cover quality", () => {
  const low = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/abc/100x100bb.jpg";
  const high = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/abc/600x600bb.jpg";

  it("prefers an iTunes 600px request and keeps the 100px fallback", () => {
    expect(preferredSongCover(low)).toBe(high);
    expect(songCoverCandidates(low)).toEqual([high, low]);
    expect(songCoverCandidates(high)).toEqual([high, low]);
  });
  it("preserves artwork quality suffix and query", () => {
    expect(preferredSongCover("https://a.mzstatic.com/a/100x100bb-85.webp?foo=1")).toBe("https://a.mzstatic.com/a/600x600bb-85.webp?foo=1");
  });
  it("never rewrites arbitrary image providers or local uploads", () => {
    for (const url of ["/uploads/anime-covers/song-test.webp", "https://example.com/100x100bb.jpg", "https://mzstatic.com.evil.example/a/100x100bb.jpg", "blob:https://example.com/id"]) {
      expect(preferredSongCover(url)).toBe(url);
      expect(songCoverCandidates(url)).toEqual([url]);
    }
    expect(preferredSongCover(null)).toBeNull();
    expect(songCoverCandidates(undefined)).toEqual([]);
  });
});
