import { TierShareMissingView, TierShareView } from "@/components/TierShareView";
import { getPublicTierShare } from "@/lib/tier-share-service";

export const dynamic = "force-dynamic";

interface ShareTierPageProps {
  params: {
    token: string;
  };
}

export default async function ShareTierPage({ params }: ShareTierPageProps) {
  try {
    const share = await getPublicTierShare(params.token);
    return <TierShareView share={share} />;
  } catch {
    return <TierShareMissingView />;
  }
}
