"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { FieldLabel, GhostButton, Pill, TextInput } from "@/components/ui";
import type { Company, Tag } from "@/features/shared/domain/tagCompany";

export function CompanyField({
  label = "Company",
  value,
  onChange,
  companies
}: {
  label?: string;
  value: string;
  onChange: (name: string) => void;
  companies: Company[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        list="company-options"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="No company"
        className="mt-2"
      />
      <datalist id="company-options">
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>
    </div>
  );
}

export function TagsField({
  label = "Tags",
  value,
  onChange,
  tags
}: {
  label?: string;
  value: string[];
  onChange: (names: string[]) => void;
  tags: Tag[];
}) {
  const [draft, setDraft] = useState("");

  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
  }

  function removeTag(name: string) {
    onChange(value.filter((existing) => existing !== name));
  }

  const suggestions = tags.filter(
    (tag) => !value.some((existing) => existing.toLowerCase() === tag.name.toLowerCase())
  );

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {value.map((name) => (
          <Pill key={name} className="bg-accent/12 text-accent ring-accent/15">
            {name}
            <button
              type="button"
              onClick={() => removeTag(name)}
              className="ml-1.5 -mr-0.5 rounded-full p-0.5 hover:bg-panel2"
              aria-label={`Remove ${name} tag`}
            >
              <X className="h-3 w-3" />
            </button>
          </Pill>
        ))}
        <input
          type="text"
          list="tag-options"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(draft);
              setDraft("");
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              addTag(draft);
              setDraft("");
            }
          }}
          placeholder="Add a tag"
          className="focus-ring h-9 min-w-[120px] flex-1 rounded-full bg-shell px-3 text-sm text-ink ring-1 ring-line placeholder:text-muted"
        />
        <datalist id="tag-options">
          {suggestions.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((tag) => (
            <GhostButton
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              className="min-h-7 rounded-full bg-panel2/50 px-2.5 py-0 text-xs ring-1 ring-line"
            >
              + {tag.name}
            </GhostButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
