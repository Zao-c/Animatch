import { describe, it, expect } from "vitest";
import { applySongTemplateVersion, compareSongTemplateVersions } from "@/lib/anisong/template-version";
import { emptySongDocument, type SongTrack, type SongDocument } from "@/lib/anisong/types";

function song(id: string): SongTrack {
  return {id,title:id,artist:"歌手",anime:"动画",kind:"OP",year:2026,quarter:4,tags:[],clipStart:0,clipLength:30,
    source:{kind:"none"},coverUrl:null};
}
function doc(ids: string[]): SongDocument {return {...emptySongDocument(),tracks:ids.map(song)}}
describe("AniSong public version safety", () => {
  it("separates added removed metadata changes and changed song identities", () => {
    const old=doc(["a","b","removed","changed"]);
    const next=doc(["a","b","new","changed"]);
    next.tracks[0].coverUrl="/cover.webp";
    next.tracks[3].title="different song";
    const diff=compareSongTemplateVersions(old,next);
    expect(diff).toMatchObject({changes:4});
    expect(diff.added.map(t=>t.id)).toEqual(["new"]);
    expect(diff.removed.map(t=>t.id)).toEqual(["removed"]);
    expect(diff.metadataChanged.map(t=>t.id)).toEqual(["a"]);
    expect(diff.identityChanged.map(t=>t.id)).toEqual(["changed"]);
  });
  it("adopts new tracks only with explicit confirmation, preserves old votes and tiers", () => {
    const old=doc(["a","b","removed"]);
    old.events=[{id:"v1",leftId:"a",rightId:"removed",result:"LEFT_WIN"}];
    old.manualTiers={removed:"S"};old.candidateIds=null;old.matchMode="quick";
    const latest=doc(["a","b","new"]);
    const noNew=applySongTemplateVersion(old,latest,false);
    expect(noNew.tracks.map(t=>t.id)).toEqual(["a","b","removed"]);
    expect(noNew.candidateIds).toEqual(["a","b"]);
    const updated=applySongTemplateVersion(old,latest,true);
    expect(updated.tracks.map(t=>t.id)).toEqual(["a","b","removed","new"]);
    expect(updated.candidateIds).toEqual(["a","b","new"]);
    expect(updated.events).toEqual(old.events);
    expect(updated.manualTiers).toEqual(old.manualTiers);
    expect(updated.matchMode).toEqual("quick");
    expect(old.tracks).toHaveLength(3);
  });
  it("does not silently reassign votes if a track ID is used for a different song", () => {
    const old=doc(["a","b"]);const now=doc(["a","b"]);
    now.tracks[0].artist="完全不同的歌手";
    expect(() => applySongTemplateVersion(old,now,true)).toThrow("歌曲身份");
  });
  it("does not import public votes or private sources", () => {
    const old=doc(["a","b"]);const now=doc(["a","b","c"]);
    now.tracks[2].source={kind:"upload",key:"private",mime:"audio/mpeg",bytes:3};
    now.events=[{id:"v",leftId:"a",rightId:"b",result:"LEFT_WIN"}];
    const merged=applySongTemplateVersion(old,now,true);
    expect(merged.events).toEqual([]);
    expect(merged.tracks[2].source).toEqual({kind:"none"});
  });
});
