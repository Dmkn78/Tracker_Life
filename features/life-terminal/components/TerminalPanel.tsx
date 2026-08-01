import type { ReactNode } from "react";

type TerminalPanelProps = {
  title: string;
  label?: string;
  children: ReactNode;
  action?: ReactNode;
};

type HeaderCellProps = {
  label: string;
  value: string;
  tone?: string;
};

type CollapsibleSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export function TerminalPanel({
  title,
  label,
  children,
  action
}: TerminalPanelProps) {
  return (
    <section className="rounded-[26px] bg-white/[0.038] p-4 shadow-[0_16px_44px_rgba(2,6,23,0.16)] ring-1 ring-white/7 backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          {label ? <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p> : null}
          <h2 className="mt-1 text-xl font-semibold text-slate-100">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HeaderCell({ label, value, tone }: HeaderCellProps) {
  return (
    <div className="min-w-0 rounded-[20px] bg-white/[0.035] px-4 py-3 ring-1 ring-white/8">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-base font-semibold ${tone ?? "text-slate-100"}`}>{value}</p>
    </div>
  );
}

export function CollapsibleSection({
  title,
  children,
  className = "",
  defaultOpen = false
}: CollapsibleSectionProps) {
  return (
    <details open={defaultOpen} className={`rounded-[22px] bg-white/[0.025] ring-1 ring-white/6 ${className}`}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-300">
        <span className="inline-flex items-center gap-2">{title}</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
