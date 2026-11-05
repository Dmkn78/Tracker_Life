"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

/** One field, Enter to add, stays open for the next task; Escape closes. */
export function InlineTaskInput({ label, placeholder, onSubmit }: {
  label: string;
  placeholder: string;
  onSubmit: (title: string) => Promise<void>;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  async function submit(): Promise<void> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setTitle("");
    await onSubmit(trimmedTitle);
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="focus-ring flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-muted transition hover:bg-panel2/60 hover:text-ink">
        <Plus className="h-4 w-4" />{label}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label={label}
      value={title}
      placeholder={placeholder}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => { if (!title.trim()) setIsOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); void submit(); }
        if (event.key === "Escape") { setTitle(""); setIsOpen(false); }
      }}
      className="focus-ring min-h-9 w-full rounded-xl bg-panel px-2.5 text-sm text-ink ring-1 ring-line placeholder:text-muted/70"
    />
  );
}
