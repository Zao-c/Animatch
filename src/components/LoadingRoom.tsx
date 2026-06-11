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
        <div className="mx-auto mb-5 h-14 w-14 animate-pulse rounded-full border border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_40px_rgba(3,218,197,0.22)]" />
        <h2 className="text-2xl font-black text-white">{message}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {typeof loaded === "number" && typeof total === "number"
            ? `图片预加载 ${loaded}/${total}`
            : "正在获取队列并预加载首批封面"}
        </p>
      </AppCard>
    </div>
  );
}
