import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SongPlayer } from "@/components/anisong/SongPlayer";
import { SongMatchCard } from "@/components/anisong/SongMatchCard";
import type { SongTrack } from "@/lib/anisong/types";

const track: SongTrack = { id: "song", title: "Cipher", artist: "Kevin MacLeod", anime: "", kind: "OTHER", year: null, quarter: null, tags: [], clipStart: 35, clipLength: 90, source: { kind: "upload", key: "local.mp3", mime: "audio/mpeg", bytes: 1000 } };

describe("song playback controls", () => {
  it("labels audition, replay, progress and shortcut independently of voting", () => {
    const html = renderToStaticMarkup(createElement(SongPlayer, { track, boardId: "board", shortcut: "q" }));
    expect(html).toContain('aria-label="试听 Cipher"');
    expect(html).toContain('aria-label="重播片段 Cipher"');
    expect(html).toContain('aria-label="Cipher 试听进度"');
    expect(html).toContain('aria-keyshortcuts="q"');
    expect(html).toContain("0:00 / 1:30");
    expect(html).toContain('preload="none"');
    expect(html).not.toContain("更喜欢");
  });
  it("renders vector controls with a reserved accessible status area", () => {
    const html = renderToStaticMarkup(createElement(SongPlayer, { track, boardId: "board", compact: true }));
    expect(html).toContain("<svg");
    expect(html).not.toContain("▶");
    expect(html).not.toContain("Ⅱ");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="音量与音源详情"');
    expect(html).toContain('aria-label="试听 Cipher"');
  });
  it("keeps the no-audio fallback without unusable controls", () => {
    const html = renderToStaticMarkup(createElement(SongPlayer, { track: { ...track, source: { kind: "none" } }, boardId: "board", shortcut: "e" }));
    expect(html).toContain("尚未添加音频");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<button");
  });
  it("starts idle and describes non-anime music without an empty anime warning", () => {
    const html = renderToStaticMarkup(createElement(SongMatchCard, { track, boardId: "board", side: "right", disabled: false, onPick() {}, onUnheard() {} }));
    expect(html).toContain('data-playback="idle"');
    expect(html).toContain('aria-keyshortcuts="e"');
    expect(html).toContain("音乐曲目");
    expect(html).not.toContain("动画未填写");
    expect(html).toContain("更喜欢右边");
  });
});
