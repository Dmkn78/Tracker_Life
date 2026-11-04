"use client";

import { Check, CornerDownLeft, Mic, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SummaryRecorder } from "@/features/daily-log/components/SummaryRecorder";
import { appendSummaryTranscript } from "@/features/daily-log/domain/summaryTranscript";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { toDateKey } from "@/lib/dates";
import {
  CAPTURE_KINDS,
  CAPTURE_SAVED_EVENT,
  CAPTURE_WHEN_OPTIONS,
  buildCaptureRequest,
  isCaptureTextValid,
  shouldSaveOnKeyPress,
  type CaptureKind,
  type CaptureSubmitter,
  type CaptureWhen
} from "../domain/quickCapture";
import { QUICK_CAPTURE_COPY, type QuickCaptureCopy } from "./quickCaptureCopy";

type SheetStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done"; message: string }
  | { kind: "failed"; message: string };

/**
 * Bottom sheet with one field. It stays open after each addition and keeps the keyboard up,
 * so several tasks can be typed in a row. Dates and other details are never required.
 */
export function QuickCaptureSheet({ initialKind, submitCapture, onClose }: {
  initialKind: CaptureKind;
  submitCapture: CaptureSubmitter;
  onClose: () => void;
}): React.ReactElement {
  const { locale } = useLocale();
  const copy = QUICK_CAPTURE_COPY[locale];
  const [kind, setKind] = useState<CaptureKind>(initialKind);
  const [when, setWhen] = useState<CaptureWhen>("today");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<SheetStatus>({ kind: "idle" });
  const [isDictationOpen, setIsDictationOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fieldRef.current?.focus(); }, [kind]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function save(): Promise<void> {
    if (!isCaptureTextValid(kind, text) || status.kind === "saving") return;
    const capture = buildCaptureRequest(kind, text, when, toDateKey());
    setStatus({ kind: "saving" });
    try {
      const outcome = await submitCapture(capture);
      setText("");
      const savedMessage = outcome === "queued" ? copy.queued : kind === "task" ? copy.savedTask[when] : copy.savedNote;
      setSavedCount((current) => current + 1);
      setStatus({ kind: "done", message: savedMessage });
      window.dispatchEvent(new CustomEvent(CAPTURE_SAVED_EVENT, { detail: capture }));
    } catch (error: unknown) {
      setStatus({ kind: "failed", message: error instanceof Error ? error.message : copy.failed });
    }
    fieldRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={copy.open}>
      <button type="button" aria-label={copy.close} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <section className="relative w-full max-w-xl rounded-t-[28px] bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] ring-1 ring-line sm:mb-6 sm:rounded-[28px]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <KindSwitch kind={kind} copy={copy} onChange={(nextKind) => { setKind(nextKind); setStatus({ kind: "idle" }); }} />
          <button type="button" aria-label={copy.close} onClick={onClose} className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-panel2 hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <textarea
          ref={fieldRef}
          aria-label={copy.placeholders[kind]}
          value={text}
          rows={kind === "task" ? 2 : 5}
          enterKeyHint={kind === "task" ? "send" : "enter"}
          placeholder={copy.placeholders[kind]}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (!shouldSaveOnKeyPress(kind, { ...event, isComposing: event.nativeEvent.isComposing })) return;
            event.preventDefault();
            void save();
          }}
          className="focus-ring mt-3 w-full resize-none rounded-2xl bg-panel2/70 px-4 py-3 text-lg leading-7 text-ink ring-1 ring-line placeholder:text-muted/70"
        />
        {kind === "task" ? <WhenChips when={when} copy={copy} onChange={setWhen} /> : null}
        {isDictationOpen ? (
          <div className="mt-3"><SummaryRecorder locale={locale} disabled={status.kind === "saving"} onTranscript={(transcript) => setText((current) => appendSummaryTranscript(current, transcript))} /></div>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setIsDictationOpen((current) => !current)} aria-pressed={isDictationOpen} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-panel2 px-4 text-sm text-ink ring-1 ring-line">
            <Mic className="h-4 w-4" />{isDictationOpen ? copy.hideDictation : copy.dictate}
          </button>
          <button
            type="button"
            disabled={!isCaptureTextValid(kind, text) || status.kind === "saving"}
            // Keeps the keyboard open: the field must not lose focus when the button is pressed.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => void save()}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-onaccent disabled:opacity-50"
          >
            {status.kind === "saving" ? copy.saving : copy.add}<CornerDownLeft className="h-4 w-4" />
          </button>
        </div>
        <StatusLine status={status} savedCount={savedCount} hint={kind === "task" ? copy.taskHint : copy.noteHint} />
      </section>
    </div>
  );
}

function KindSwitch({ kind, copy, onChange }: { kind: CaptureKind; copy: QuickCaptureCopy; onChange: (kind: CaptureKind) => void }): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={copy.kindLabel} className="inline-flex rounded-full bg-panel2 p-1 ring-1 ring-line">
      {CAPTURE_KINDS.map((candidate) => (
        <button key={candidate} type="button" role="radio" aria-checked={candidate === kind} onClick={() => onChange(candidate)} className={`focus-ring min-h-9 rounded-full px-4 text-sm font-medium transition ${candidate === kind ? "bg-panel text-ink shadow ring-1 ring-line" : "text-muted"}`}>
          {copy.kinds[candidate]}
        </button>
      ))}
    </div>
  );
}

function WhenChips({ when, copy, onChange }: { when: CaptureWhen; copy: QuickCaptureCopy; onChange: (when: CaptureWhen) => void }): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={copy.whenLabel} className="mt-3 flex flex-wrap gap-2">
      {CAPTURE_WHEN_OPTIONS.map((candidate) => (
        <button key={candidate} type="button" role="radio" aria-checked={candidate === when} onPointerDown={(event) => event.preventDefault()} onClick={() => onChange(candidate)} className={`focus-ring min-h-9 rounded-full px-3.5 text-sm ring-1 transition ${candidate === when ? "bg-accent/15 text-accent ring-accent/50" : "text-muted ring-line"}`}>
          {copy.when[candidate]}
        </button>
      ))}
    </div>
  );
}

function StatusLine({ status, savedCount, hint }: { status: SheetStatus; savedCount: number; hint: string }): React.ReactElement {
  if (status.kind === "done") {
    const counter = savedCount > 1 ? ` (${savedCount})` : "";
    return <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-good"><Check className="h-4 w-4" />{`${status.message}${counter}`}</p>;
  }
  if (status.kind === "failed") return <p role="alert" className="mt-2 text-sm text-risk">{status.message}</p>;
  return <p className="mt-2 text-xs text-muted">{hint}</p>;
}
