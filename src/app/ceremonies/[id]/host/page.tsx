import { AwardLive } from "@/components/AwardLive";
export default function Page({ params }: { params: { id: string } }) { return <AwardLive id={params.id} mode="host" />; }
