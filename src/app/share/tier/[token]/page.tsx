import { TierShareMissingView, TierShareView } from "@/components/TierShareView";
import { getPublicTierShare } from "@/lib/tier-share-service";
import { AppError } from "@/lib/app-error";

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
  } catch (error) {
    if (error instanceof AppError && error.code === "TIER_SHARE_NOT_FOUND") {
      return <TierShareMissingView />;
    }
    return <TierShareMissingView unavailable />;
  }
}
