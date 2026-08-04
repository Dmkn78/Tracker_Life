"use client";

import { FieldLabel } from "@/components/ui";

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = ""
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <FieldLabel>{label}</FieldLabel>
        <span className="tabular-nums text-lg font-semibold text-ink">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-8 w-full"
      />
    </div>
  );
}
