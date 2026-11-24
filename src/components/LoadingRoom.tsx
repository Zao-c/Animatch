import { AppCard } from "./ui/AppCard";

export function LoadingRoom({
  loaded,
  total,
  message = "正在准备你的对决..."
}: {
  loaded?: number;
  total?: number;
  message?: string;
}) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <AppCard className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-full border border-white/15 bg-white/[0.06]" />
        <h2 className="text-xl font-bold text-white">{message}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {typeof loaded === "number" && typeof total === "number"
            ? `图片预加载 ${loaded}/${total}`
            : "正在获取队列并预加载首批封面"}
        </p>
      </AppCard>
    </div>
  );
}
