"use client";

import { useEffect, useState } from "react";

/** Free text saved when the field loses focus; nothing to click. */
export function RecapField({ label, placeholder, initialText, rows, onSave, savedLabel }: {
  label: string;
  placeholder: string;
  initialText: string | null;
  rows: number;
  onSave: (text: string) => Promise<void>;
  savedLabel: string;
}): React.ReactElement {
  const [text, setText] = useState(initialText ?? "");
  const [wasSaved, setWasSaved] = useState(false);

  useEffect(() => { setText(initialText ?? ""); }, [initialText]);

  async function saveIfChanged(): Promise<void> {
    if (text.trim() === (initialText ?? "").trim()) return;
    await onSave(text);
    setWasSaved(true);
    window.setTimeout(() => setWasSaved(false), 1500);
  }

  return (
    <div className="grid gap-1">
      <textarea
        aria-label={label}
        rows={rows}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void saveIfChanged()}
        className="focus-ring w-full resize-y rounded-xl bg-panel/70 px-2.5 py-2 text-sm text-ink ring-1 ring-line placeholder:text-muted/70"
      />
      {wasSaved ? <p role="status" className="text-xs text-good">{savedLabel}</p> : null}
    </div>
  );
}
