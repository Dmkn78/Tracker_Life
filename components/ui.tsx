import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { X } from "lucide-react";

export function Card({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[24px] bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.18)] ring-1 ring-white/8 backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

export const Panel = Card;

export function SoftPanel({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`min-w-0 overflow-hidden rounded-[20px] bg-white/[0.035] p-4 ring-1 ring-white/6 ${className}`}>{children}</div>;
}

export function IconButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex max-w-full min-h-10 items-center justify-center gap-2 rounded-2xl bg-white/[0.05] px-3.5 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex max-w-full min-h-10 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-slate-950 shadow-[0_10px_25px_rgba(141,162,251,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex max-w-full min-h-10 items-center justify-center gap-2 rounded-2xl bg-white/[0.03] px-4 text-sm font-medium text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex max-w-full min-h-9 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function Metric({
  label,
  value,
  tone = "neutral",
  detail
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "risk";
  detail?: string;
}) {
  const colors = {
    neutral: "bg-white/[0.04] text-slate-100 ring-white/8",
    good: "bg-good/10 text-good ring-good/15",
    warn: "bg-warn/10 text-warn ring-warn/15",
    risk: "bg-risk/10 text-risk ring-risk/15"
  };
  return (
    <div className={`min-w-0 rounded-[20px] px-4 py-3 ring-1 ${colors[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-xl font-semibold sm:text-2xl">{value}</div>
      {detail ? <div className="mt-1 text-xs text-slate-500">{detail}</div> : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-slate-300">{children}</label>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`focus-ring h-11 min-w-0 w-full rounded-2xl bg-black/20 px-3.5 text-slate-100 ring-1 ring-white/8 placeholder:text-slate-500 ${props.className ?? ""}`}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`focus-ring h-10 min-w-0 w-full rounded-2xl bg-black/20 px-3.5 text-sm font-medium text-slate-100 ring-1 ring-white/8 ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`focus-ring min-w-0 w-full rounded-2xl bg-black/20 p-3.5 text-slate-100 ring-1 ring-white/8 placeholder:text-slate-500 ${props.className ?? ""}`}
    />
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/[0.05] ${className}`}>
      <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Pill({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`inline-flex max-w-full items-center rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/8 ${className}`}>{children}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  detail,
  action,
  className = ""
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-3 md:flex-row md:items-end ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p> : null}
        <h2 className="mt-1 text-2xl font-semibold text-slate-50">{title}</h2>
        {detail ? <p className="mt-2 max-w-3xl text-sm text-slate-400">{detail}</p> : null}
      </div>
      {action ? <div className="flex max-w-full flex-wrap gap-2 md:justify-end">{action}</div> : null}
    </div>
  );
}

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = "md"
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  if (!open) return null;
  const widths = {
    sm: "md:max-w-md",
    md: "md:max-w-xl",
    lg: "md:max-w-2xl"
  };
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/55 backdrop-blur-sm">
      <button aria-label="Close" className="hidden flex-1 cursor-default md:block" onClick={onClose} />
      <div className={`flex h-full w-full min-w-0 flex-col bg-[#121722]/96 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.35)] sm:p-5 ${widths[width]}`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-50">{title}</h3>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <GhostButton type="button" onClick={onClose} className="min-h-10 min-w-10 px-0">
            <X className="h-4 w-4" />
          </GhostButton>
        </div>
        <div className="thin-scrollbar min-w-0 flex-1 overflow-y-auto py-5">{children}</div>
        {footer ? <div className="border-t border-white/8 pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Segmented({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`inline-flex max-w-full flex-wrap rounded-2xl bg-white/[0.045] p-1 ring-1 ring-white/8 ${className}`} />;
}

export function SegmentedButton({
  active,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex min-h-9 items-center justify-center rounded-[14px] px-3 text-sm font-medium transition ${
        active ? "bg-white/[0.09] text-slate-50 shadow-[0_1px_0_rgba(255,255,255,0.06)]" : "text-slate-400 hover:text-slate-200"
      } ${className}`}
    >
      {children}
    </button>
  );
}
