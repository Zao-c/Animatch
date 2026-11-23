import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SongLobby } from "@/components/anisong/SongLobby";
export const metadata: Metadata = { title: "AnisongMatch · AniMatch", description: "听一段，选一首。用音乐对决生成你的 OP / ED Tier List。" };
export default function AnisongPage() { return <PageShell><SongLobby /></PageShell>; }
