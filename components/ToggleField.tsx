"use client";

import { Check, X } from "lucide-react";
import { FieldLabel, IconButton } from "@/components/ui";

export function ToggleField({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <IconButton
          type="button"
          onClick={() => onChange(true)}
          className={value === true ? "border-good bg-good/10 text-good" : ""}
        >
          <Check className="h-4 w-4" />
          Yes
        </IconButton>
        <IconButton
          type="button"
          onClick={() => onChange(false)}
          className={value === false ? "border-risk bg-risk/10 text-risk" : ""}
        >
          <X className="h-4 w-4" />
          No
        </IconButton>
      </div>
    </div>
  );
}
