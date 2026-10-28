import { PageShell } from "@/components/PageShell";
import { SongWorkspace } from "@/components/anisong/SongWorkspace";
export default function SongBoardPage({ params }: { params: { boardId: string } }) {
  return <PageShell><SongWorkspace key={params.boardId} boardId={params.boardId} /></PageShell>;
}
