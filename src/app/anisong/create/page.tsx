import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/lib/auth-session";
import { SongLobby } from "@/components/anisong/SongLobby";

export const metadata: Metadata = { title: "创建音乐曲单 · AniMatch" };

export default async function CreateSongPlaylistPage() {
  if (!await getCurrentUser()) redirect("/login?next=%2Fanisong%2Fcreate");
  return <PageShell><SongLobby view="create" /></PageShell>;
}
