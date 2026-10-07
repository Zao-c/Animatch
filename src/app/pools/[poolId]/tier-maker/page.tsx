import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ManualTierBoard } from "@/components/ManualTierBoard";
import { getCurrentUser } from "@/lib/auth-session";
import { getManualBoard } from "@/lib/manual-board-service";
import { isAppError } from "@/lib/app-error";
export const dynamic = "force-dynamic";
export default async function ManualTierPage({ params }: { params: { poolId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pools/${params.poolId}/tier-maker`)}`);
  try { const board = await getManualBoard(user.id, params.poolId); return <PageShell><ManualTierBoard initial={board} /></PageShell>; }
  catch (error) {
    if (!isAppError(error)) throw error;
    return <PageShell><p role="alert">{error.message}</p></PageShell>;
  }
}
