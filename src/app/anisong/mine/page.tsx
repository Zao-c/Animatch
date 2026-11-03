import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SongLobby } from "@/components/anisong/SongLobby";
export const metadata: Metadata = { title: "我的音乐曲单 · AniMatch" };
export default function MySongPlaylistsPage() { return <PageShell><SongLobby view="mine" /></PageShell>; }
