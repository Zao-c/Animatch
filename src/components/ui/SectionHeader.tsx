export function SectionHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
