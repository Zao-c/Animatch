import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong playlists expose both inspect and match actions", () => {
  const publicGallery = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
  const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");
  const card = readFileSync("src/components/anisong/SongPlaylistCard.tsx", "utf8");
  const detailRoute = readFileSync("src/app/anisong/templates/[templateId]/page.tsx", "utf8");
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");

  it("provides a visible public playlist detail link independently of starting a match", () => {
    expect(publicGallery).toContain('<Link href={`/anisong/templates/${template.id}`}');
    expect(publicGallery).toContain("查看曲单</Link>");
    expect(publicGallery).toContain('onClick={() => void start(template)}');
    expect(publicGallery).toContain('router.push(`/anisong/${board.id}/match`)');
    expect(publicGallery).toContain("<SongShareButton");
    expect(card).toContain('aria-label={`查看曲单：${title}`}');
  });

  it("offers a personal playlist detail entry separate from resume match", () => {
    expect(lobby).toContain('<Link href={`/anisong/${item.id}`}');
    expect(lobby).toContain("查看曲单</Link>");
    expect(lobby).toContain('item.canStart ? `/anisong/${item.id}/match`');
  });

  it("the public detail page displays track browsing, audition, range and community", () => {
    expect(detailRoute).toContain("SongTemplateDetail");
    expect(detail).toContain('DashboardTabs id="song-public"');
    expect(detail).toContain('label: "歌曲谱"');
    expect(detail).toContain('label: "参赛范围"');
    expect(detail).toContain('label: "社区榜"');
    expect(detail).toContain("<SongPlayer");
    expect(detail).toContain("const SONGS_PER_PAGE = 12");
  });
});
