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
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl font-bold text-zinc-200">
        A
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </AppCard>
  );
}
