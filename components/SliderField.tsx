"use client";

import { FieldLabel } from "@/components/ui";
import { useId } from "react";

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
  const inputId = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        <span className="tabular-nums text-lg font-semibold text-ink">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={inputId}
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
