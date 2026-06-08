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
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-full border border-cyan-300/40 bg-cyan-300/10" />
        <h2 className="text-2xl font-semibold text-white">{message}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {typeof loaded === "number" && typeof total === "number"
            ? `图片预加载 ${loaded}/${total}`
            : "正在获取队列并预加载首批封面"}
        </p>
      </div>
    </div>
  );
}
