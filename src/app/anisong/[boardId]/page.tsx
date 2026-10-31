import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { SongWorkspace } from "@/components/anisong/SongWorkspace";

export default function SongBoardPage({ params, searchParams }: {
  params: { boardId: string }; searchParams?: { view?: string };
}) {
  // Preserve all legacy ?view= bookmarks when moving to real routes.
  if (searchParams?.view === "match" || searchParams?.view === "tier") {
    redirect("/anisong/" + params.boardId + "/" + searchParams.view);
  }
  return <PageShell><SongWorkspace key={params.boardId} boardId={params.boardId} view="library" /></PageShell>;
}
