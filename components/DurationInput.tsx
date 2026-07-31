"use client";

import { useEffect, useState } from "react";
import { FieldLabel } from "@/components/ui";

export function DurationInput({
  label,
  value,
  onChange,
  placeholder = "1h 30m",
  showStored = true
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  showStored?: boolean;
}) {
  const [draft, setDraft] = useState(formatDuration(value));

  useEffect(() => {
    setDraft(formatDuration(value));
  }, [value]);

  function commit(nextDraft = draft) {
    const parsed = parseDuration(nextDraft);
    if (parsed != null) {
      onChange(parsed);
      setDraft(formatDuration(parsed));
    } else {
      setDraft(formatDuration(value));
    }
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        inputMode="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
        className="focus-ring mt-2 h-11 w-full rounded-md border border-line bg-shell px-3 font-mono text-slate-100 placeholder:text-slate-500"
        placeholder={placeholder}
      />
      {showStored ? <p className="mt-1 font-mono text-[11px] text-slate-500">{value} min stored</p> : null}
    </div>
  );
}

export function parseDuration(input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return 0;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value));

  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)\s*([dhm])/g)];
  const matchedText = matches.map((match) => match[0]).join("").replace(/\s/g, "");
  if (matches.length === 0 || matchedText !== value.replace(/\s/g, "")) return null;

  const minutes = matches.reduce((total, match) => {
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === "d") return total + amount * 24 * 60;
    if (unit === "h") return total + amount * 60;
    return total + amount;
  }, 0);

  return Math.max(0, Math.round(minutes));
}

export function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  if (safeMinutes === 0) return "0m";
  const days = Math.floor(safeMinutes / 1440);
  const hours = Math.floor((safeMinutes % 1440) / 60);
  const minutes = safeMinutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
    .filter(Boolean)
    .join(" ");
}
