import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong public lobby keeps one clear action per playlist", () => {
  const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");
  const gallery = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  const card = readFileSync("src/components/anisong/SongPlaylistCard.tsx", "utf8");

  it("uses one create route and keeps all three destinations on a single mobile row", () => {
    expect(lobby).toContain('href: "/anisong/create"');
    expect(lobby).toContain("grid grid-cols-3 gap-1");
    expect(lobby).toContain('aria-current={item.id === view ? "page" : undefined}');
    expect(lobby).not.toContain("＋ 创建曲单</Link>");
    expect(lobby).not.toContain("曲单详情</Link>");
    expect(lobby).toContain("item.canStart");
  });

  it("keeps public cards searchable, clickable and directly playable without repeating detail CTAs", () => {
    expect(gallery).toContain('role="search"');
    expect(gallery).toContain('<h2 className="sr-only">公开曲单</h2>');
    expect(gallery).not.toContain("曲单详情</Link>");
    expect(gallery).not.toContain('tag={template.mine ? "我创建的" : "公开"}');
    expect(gallery).toContain("进入对决");
    expect(gallery).toContain("onClick={() => void start(template)}");
    expect(gallery).toContain("<SongShareButton");
    expect(gallery).toContain("设为私人／下架");
    expect(gallery).toContain("重试加载");
  });

  it("keeps accessible cover/title navigation without duplicate buttons", () => {
    expect(card).toContain('aria-label={`查看曲单：${title}`}');
    expect(card).toContain("focus-visible:outline");
    expect(card).toContain("href={href}");
  });

  it("keeps filters, playback, range selection and two match entry points", () => {
    expect(detail).not.toContain('<AppBadge tone="success">公开</AppBadge>');
    expect(detail).toContain('DashboardTabs id="song-public"');
    expect(detail).toContain("const SONGS_PER_PAGE = 12");
    expect(detail).toContain("SongPlayer track={track}");
    expect(detail).toContain('aria-label={`选择参赛：${track.title}`}');
    expect(detail).toContain('{busy ? "正在保存…" : "开始对决"}');
    expect(detail).toContain('onClick={() => void start()}');
    expect(detail).toContain("<SongShareButton");
  });
});
