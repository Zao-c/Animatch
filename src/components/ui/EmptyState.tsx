import { AppCard } from "./AppCard";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <AppCard className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl font-bold text-cyan-200 shadow-[0_0_30px_rgba(3,218,197,0.16)]">
        A
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </AppCard>
  );
}
