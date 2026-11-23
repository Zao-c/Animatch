import { TierShareView, TierShareMissingView } from "@/components/TierShareView";
import { getSharedManualBoard } from "@/lib/manual-board-service";
export const dynamic = "force-dynamic";
export default async function ManualBoardSharePage({ params }: { params: { token: string } }) {
  const share = await getSharedManualBoard(params.token);
  return share ? <TierShareView share={share} /> : <TierShareMissingView />;
}
