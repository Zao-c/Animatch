import { MAX_SONG_COVER_BYTES } from "./types";

export type LocalSongMetadata = { title: string; artist: string; cover: Blob | null; note: string };
export function filenameMetadata(name: string): Pick<LocalSongMetadata, "title" | "artist"> {
  const stem = name.replace(/\.[^.]+$/, "");
  const split = stem.indexOf(" - ");
  return { title: (split > 0 ? stem.slice(split + 3) : stem).trim().slice(0, 120), artist: split > 0 ? stem.slice(0, split).trim().slice(0, 120) : "" };
}
export function cleanSongTag(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) : "";
}
// RIFF INFO has no reliable encoding declaration. Some writers store UTF-8
// while parsers read Latin-1; repair only byte strings that are valid UTF-8.
export function riffSongTag(value: unknown): string {
  if (typeof value !== "string") return "";
  if ([...value].every(c => c.charCodeAt(0) <= 255) && /[\u0080-\u00ff]/.test(value)) {
    try { value = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(value, c => c.charCodeAt(0))); }
    catch { /* Preserve correctly decoded Latin-1 tags. */ }
  }
  return cleanSongTag(value);
}
export function embeddedCover(pictures: { format: string; data: Uint8Array; type?: string }[] = []): Blob | null {
  const usable = pictures.filter(p => p.data.byteLength > 0 && p.data.byteLength <= MAX_SONG_COVER_BYTES && /^image\/(jpeg|png|webp|gif)$/i.test(p.format));
  const picture = usable.find(p => p.type?.toLowerCase() === "cover (front)") ?? usable[0];
  return picture ? new Blob([new Uint8Array(picture.data)], { type: picture.format.toLowerCase() }) : null;
}
