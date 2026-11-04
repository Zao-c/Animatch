import type { SongDocument, SongTrack } from "./types";
import { templateDocument } from "./shared/templates";

/** A public version never overwrites the history of a participant's match. */
const identity = (t: SongTrack) => [t.title.trim(), t.artist.trim(), t.anime.trim(), t.kind].join("\u001f");
const metadata = (t: SongTrack) => JSON.stringify([
  t.year, t.quarter, t.tags, t.clipStart, t.clipLength, t.coverUrl, t.itunes, t.source
]);
export type SongVersionTrack = { id: string; title: string };
export type SongVersionDiff = {
  added: SongVersionTrack[];
  removed: SongVersionTrack[];
  identityChanged: SongVersionTrack[];
  metadataChanged: SongVersionTrack[];
  changes: number;
};

/** Return display-safe metadata only, never private source URLs or upload keys. */
export function compareSongTemplateVersions(old: SongDocument, published: SongDocument): SongVersionDiff {
  const previous = new Map(old.tracks.map(t => [t.id,t]));
  const current = new Map(published.tracks.map(t => [t.id,t]));
  const added = published.tracks.filter(t => !previous.has(t.id)).map(({id,title}) => ({id,title}));
  const removed = old.tracks.filter(t => !current.has(t.id)).map(({id,title}) => ({id,title}));
  const identityChanged = published.tracks.filter(t => previous.has(t.id) && identity(previous.get(t.id)!) !== identity(t))
    .map(({id,title}) => ({id,title}));
  const metadataChanged = published.tracks.filter(t => previous.has(t.id) && identity(previous.get(t.id)!) === identity(t) &&
    metadata(previous.get(t.id)!) !== metadata(t)).map(({id,title}) => ({id,title}));
  return {added,removed,identityChanged,metadataChanged,changes:added.length+removed.length+identityChanged.length+metadataChanged.length};
}

/** The participant explicitly confirms this merge. Old comparisons and manual edits stay.
 * Deletions are excluded from new matches but retained in the historic ledger.
 * Reused IDs with changed identity are deliberately not mergeable. */
export function applySongTemplateVersion(old: SongDocument, latest: SongDocument, includeNew: boolean): SongDocument {
  const diff = compareSongTemplateVersions(old,latest);
  if (diff.identityChanged.length) throw new Error("发现同一歌曲编号对应不同的歌曲身份。为保护旧对决，请创建者使用新的歌曲编号重新发布后再更新。");
  const current = new Map(latest.tracks.map(t => [t.id,t]));
  const cleaned = templateDocument(latest.tracks).tracks;
  const safe = new Map(cleaned.map(t => [t.id,t]));
  const oldIds = new Set(old.tracks.map(t => t.id));
  const tracks = [
    ...old.tracks.map(track => {
      const matched = current.get(track.id);
      return matched ? { ...track, ...safe.get(track.id)! } : track;
    }),
    ...(includeNew ? cleaned.filter(t => !oldIds.has(t.id)) : [])
  ];
  const active = old.candidateIds ?? old.tracks.map(t => t.id);
  const kept = active.filter(id => current.has(id));
  const candidates = includeNew ? [...kept,...diff.added.map(t => t.id)] : kept;
  const distinct = [...new Set(candidates)];
  if (distinct.length < 2) throw new Error("更新后参赛歌曲不足两首，请保留旧版本或联系创建者。");
  const allSelected = distinct.length === tracks.length;
  return {...old,tracks,candidateIds: allSelected ? null : distinct};
}
