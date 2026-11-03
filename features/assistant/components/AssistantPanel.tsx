"use client";

import { Bot, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FieldLabel, Panel, PrimaryButton, SecondaryButton, SelectInput, TextArea } from "@/components/ui";
import { SummaryRecorder } from "@/features/daily-log/components/SummaryRecorder";
import { appendSummaryTranscript } from "@/features/daily-log/domain/summaryTranscript";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { createTodoTasks } from "@/features/todo/api/todoApi";
import { ApiError } from "@/lib/http/apiClient";
import { previewAssistant } from "../api/assistantApi";
import { useDefaultAiProvider } from "@/features/ai-providers/application/useDefaultAiProvider";
import { parseAssistantTask, resolveAssistantInstruction, type AssistantInstruction, type AssistantMode, type AssistantPreview, type AssistantTask } from "../domain/assistant";
import { AssistantTaskEditor, type AssistantTaskSelection } from "./AssistantTaskEditor";
import { ASSISTANT_COPY } from "./assistantCopy";

export type AssistantPanelProps = {
  date: string;
  initialMode?: AssistantMode;
  onTasksCreated?: () => void | Promise<void>;
  beforePreview?: () => Promise<void>;
  disabled?: boolean;
};
type PreviewState = { preview: AssistantPreview; tasks: AssistantTaskSelection[]; status: "ready" | "saved" | "uncertain" };

export function AssistantPanel({ date, initialMode = "tasks", onTasksCreated, beforePreview, disabled = false }: AssistantPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const copy = ASSISTANT_COPY[locale];
  const providerState = useDefaultAiProvider();
  const isProviderReady = providerState.kind === "ready";
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<AssistantMode>(initialMode);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecorderBusy, setIsRecorderBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const savingRef = useRef(false);
  const savedPreviewRef = useRef<PreviewState | null>(null);
  const mountedRef = useRef(false);
  const recorderBusyRef = useRef(false);
  const reportRecorderBusy = useCallback((busy: boolean): void => {
    recorderBusyRef.current = busy;
    setIsRecorderBusy(busy);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setIsLoading(false);
    setPreviewState(null);
    setError("");
    setStatus("");
    setMode(initialMode);
  }, [date, initialMode]);

  function cancelPreview(): void {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setIsLoading(false);
    setStatus(copy.cancelled);
  }

  async function preparePreview(): Promise<void> {
    if (requestRef.current || savingRef.current || recorderBusyRef.current || disabled) return;
    if (!isProviderReady) { setError(copy.configure); return; }
    let instruction: AssistantInstruction;
    try { instruction = resolveAssistantInstruction(prompt, mode, date); }
    catch { setError(copy.validation); return; }
    if (instruction.mode === "tasks" && !instruction.prompt) { setError(copy.empty); return; }
    const controller = new AbortController();
    const generation = ++generationRef.current;
    requestRef.current = controller;
    setIsLoading(true);
    setError("");
    setStatus("");
    setPreviewState(null);
    try {
      await beforePreview?.();
      if (controller.signal.aborted || generation !== generationRef.current) return;
      const preview = await previewAssistant(instruction, controller.signal);
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setPreviewState({ preview, status: "ready", tasks: preview.tasks.map((task, index) => ({ ...task, key: `${generation}:${index}`, selected: true })) });
    } catch (cause: unknown) {
      if (!controller.signal.aborted && generation === generationRef.current) setError(cause instanceof Error ? cause.message : copy.failed);
    } finally {
      if (generation === generationRef.current) { requestRef.current = null; setIsLoading(false); }
    }
  }

  async function confirmTasks(): Promise<void> {
    if (!previewState || previewState.status !== "ready" || savedPreviewRef.current === previewState || savingRef.current || requestRef.current || recorderBusyRef.current || disabled) return;
    const selectedTasks = previewState.tasks.filter((task) => task.selected);
    if (!selectedTasks.length) return;
    let validatedTasks: AssistantTask[];
    try { validatedTasks = selectedTasks.map(parseAssistantTask); }
    catch { setError(copy.validation); return; }
    savingRef.current = true;
    const generation = generationRef.current;
    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      await createTodoTasks({ items: validatedTasks });
      savedPreviewRef.current = previewState;
      if (mountedRef.current) {
        // Consume this exact preview before refreshing: a refresh failure cannot reopen creation.
        setPreviewState((current) => current === previewState ? { ...current, status: "saved" } : current);
        if (generation === generationRef.current) setStatus(copy.saved);
      }
      try { await onTasksCreated?.(); }
      catch { if (mountedRef.current && generation === generationRef.current) setError(copy.refreshFailed); }
    } catch (cause: unknown) {
      const isDefiniteRejection = cause instanceof ApiError && cause.status >= 400 && cause.status < 500;
      if (!isDefiniteRejection) {
        savedPreviewRef.current = previewState;
        if (mountedRef.current) setPreviewState((current) => current === previewState ? { ...current, status: "uncertain" } : current);
      }
      if (mountedRef.current && generation === generationRef.current) setError(isDefiniteRejection ? `${copy.saveFailed}${cause instanceof Error ? ` ${cause.message}` : ""}` : copy.uncertain);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  }

  function updateTask(key: string, patch: Partial<AssistantTaskSelection>): void {
    setPreviewState((current) => current?.status === "ready" ? { ...current, tasks: current.tasks.map((task) => task.key === key ? { ...task, ...patch } : task) } : current);
    setError("");
  }

  const isBusy = disabled || isLoading || isSaving;
  const areActionsDisabled = isBusy || isRecorderBusy;
  const selectedCount = previewState?.tasks.filter((task) => task.selected).length ?? 0;
  return <Panel>
    <div className="flex items-start gap-3"><Bot className="mt-1 h-5 w-5 shrink-0 text-violet" /><div><h2 className="text-lg font-semibold text-ink">{copy.title}</h2><p className="mt-1 text-sm text-muted">{copy.description}</p></div></div>
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3"><div className="min-w-48 flex-1"><SelectInput aria-label={copy.title} value={mode} disabled={areActionsDisabled} onChange={(event) => { const nextMode = event.target.value; if (nextMode === "tasks" || nextMode === "day" || nextMode === "week") setMode(nextMode); }}><option value="tasks">{copy.tasks}</option><option value="day">{copy.day}</option><option value="week">{copy.week}</option></SelectInput></div><p className="text-sm text-muted">{copy.date} : <time dateTime={date}>{date}</time></p></div>
      <p className="text-xs text-muted">{copy.weekHint}</p>
      <FieldLabel className="block">{copy.instruction}<TextArea className="mt-2" rows={4} maxLength={8000} value={prompt} disabled={isBusy} onChange={(event) => setPrompt(event.target.value)} placeholder={copy.placeholder} /></FieldLabel>
      <p className="text-xs leading-5 text-muted">{copy.commands}</p>
      <SummaryRecorder key={date} locale={locale} disabled={isBusy} onBusyChange={reportRecorderBusy} onTranscript={(transcript) => setPrompt((current) => appendSummaryTranscript(current, transcript))} />
      <p className="text-xs text-muted">{copy.voice}</p>
      {providerState.kind === "ready" ? <p className="break-words text-xs text-muted">{providerState.provider.label} · {providerState.provider.model}</p> : providerState.kind === "loading" ? null : <p className="text-sm text-warn">{copy.configure}</p>}
      <div className="flex flex-wrap gap-2"><PrimaryButton type="button" disabled={areActionsDisabled || !isProviderReady} onClick={() => void preparePreview()}>{isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{isLoading ? copy.loading : copy.preview}</PrimaryButton>{isLoading ? <SecondaryButton type="button" onClick={cancelPreview}>{copy.cancel}</SecondaryButton> : null}</div>
      {previewState ? <div className="space-y-4 border-t border-line pt-4">
        <p className="text-xs text-muted">{previewState.preview.from} → {previewState.preview.to}</p>
        {previewState.preview.analysis ? <div><h3 className="font-semibold text-ink">{copy.analysis}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{previewState.preview.analysis}</p></div> : null}
        <h3 className="font-semibold text-ink">{copy.proposals}</h3>
        {!previewState.tasks.length ? <p className="text-sm text-muted">{copy.none}</p> : previewState.tasks.map((task) => <AssistantTaskEditor key={task.key} task={task} disabled={isBusy || previewState.status !== "ready"} onChange={(patch) => updateTask(task.key, patch)} onRemove={() => setPreviewState((current) => current?.status === "ready" ? { ...current, tasks: current.tasks.filter((candidate) => candidate.key !== task.key) } : current)} />)}
        {previewState.tasks.length ? <PrimaryButton type="button" disabled={areActionsDisabled || !selectedCount || previewState.status !== "ready"} onClick={() => void confirmTasks()}>{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{isSaving ? copy.saving : `${copy.validate} (${selectedCount})`}</PrimaryButton> : null}
      </div> : null}
      {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-muted">{status}</p> : null}
    </div>
  </Panel>;
}
