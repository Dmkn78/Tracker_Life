"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { GhostButton, Pill } from "@/components/ui";
import { readNote } from "../api/knowledgeApi";
import { listFrontmatterChips, type NoteDocument } from "../domain/knowledge";
import type { KnowledgeCopy } from "./knowledgeCopy";

export function NoteReader({ path, copy, onOpen, onClose }: {
  path: string;
  copy: KnowledgeCopy;
  onOpen: (path: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const [note, setNote] = useState<NoteDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setNote(null);
    setError("");
    readNote(path, controller.signal).then(setNote).catch((readError: unknown) => {
      if (!controller.signal.aborted) setError(readError instanceof Error ? readError.message : copy.failed);
    });
    return () => controller.abort();
  }, [path, copy.failed]);

  return (
    <article className="grid gap-3 rounded-[22px] bg-panel p-4 ring-1 ring-accent/40">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs text-muted">{path}</p>
          <p className="mt-1 text-xs text-muted">{copy.readOnly}</p>
        </div>
        <GhostButton type="button" aria-label={copy.close} onClick={onClose}><X className="h-4 w-4" /></GhostButton>
      </header>
      {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
      {note ? (
        <>
          <div className="flex flex-wrap gap-1.5">{listFrontmatterChips(note.frontmatter).map((chip) => <Pill key={chip}>{chip}</Pill>)}</div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-panel2/60 p-3 font-sans text-sm leading-6 text-ink">{note.body.replace(/<!-- tracker:(begin|end)[^>]*-->\n?/g, "")}</pre>
          {note.links.length ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">{copy.links}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {note.links.map((link) => <button key={link.path} type="button" onClick={() => onOpen(link.path)} className="focus-ring rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent ring-1 ring-accent/30">{link.title}</button>)}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
