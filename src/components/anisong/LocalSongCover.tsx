"use client";
import { useEffect, useState } from "react";
import { SongCover } from "./SongCover";

export function LocalSongCover({ cover, title }: { cover: Blob | null; title: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!cover) { setUrl(""); return; }
    const next = URL.createObjectURL(cover); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [cover]);
  return <SongCover src={url} title={title} className="w-16 shrink-0 sm:w-20" />;
}
