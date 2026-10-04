"use client";

import { useEffect, useId, useState } from "react";
import { FieldLabel } from "@/components/ui";
import { formatDuration, parseDuration } from "@/lib/duration";

export { formatDuration, parseDuration } from "@/lib/duration";

export function DurationInput({
  label,
  value,
  onChange,
  placeholder = "1h 30m",
  showStored = true,
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  showStored?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();
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
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <input
        id={inputId}
        type="text"
        inputMode="text"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
        className="focus-ring mt-2 h-11 w-full rounded-md border border-line bg-shell px-3 font-mono text-ink placeholder:text-muted"
        placeholder={placeholder}
      />
      {showStored ? <p className="mt-1 font-mono text-[11px] text-muted">{value} min stored</p> : null}
    </div>
  );
}
