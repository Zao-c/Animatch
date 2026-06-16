import { TierShareMissingView, TierShareView } from "@/components/TierShareView";
import { getPublicTierShare } from "@/lib/tier-share-service";

export const dynamic = "force-dynamic";

interface ShareTierPageProps {
  params: {
    token: string;
  };
  searchParams: {
    export?: string;
  };
}

export default async function ShareTierPage({
  params,
  searchParams
}: ShareTierPageProps) {
  const exportMode = searchParams.export === "1";

  try {
    const share = await getPublicTierShare(params.token);
    return <TierShareView share={share} exportMode={exportMode} />;
  } catch {
    return <TierShareMissingView />;
  }
}
