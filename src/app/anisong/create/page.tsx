import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SongLobby } from "@/components/anisong/SongLobby";
export const metadata: Metadata = { title: "创建音乐曲单 · AniMatch" };
export default function CreateSongPlaylistPage() { return <PageShell><SongLobby view="create" /></PageShell>; }
