"use client";

import { SelectInput, TextInput } from "@/components/ui";

/** A list when models were discovered, otherwise a free identifier (some servers hide their list). */
export function ModelPicker({ label, placeholder, models, value, onChange }: {
  label: string;
  placeholder: string;
  models: string[];
  value: string;
  onChange: (model: string) => void;
}): React.ReactElement {
  if (models.length === 0) {
    return <TextInput aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  return (
    <SelectInput aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {value && !models.includes(value) ? <option value={value}>{value}</option> : null}
      {models.map((model) => <option key={model} value={model}>{model}</option>)}
    </SelectInput>
  );
}
