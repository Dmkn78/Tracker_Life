"use client";

import { Trash2 } from "lucide-react";
import { FieldLabel, GhostButton, SelectInput, SoftPanel, TextArea, TextInput } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { AssistantTask } from "../domain/assistant";
import { ASSISTANT_COPY } from "./assistantCopy";

export type AssistantTaskSelection = AssistantTask & { key: string; selected: boolean };
type AssistantTaskEditorProps = { task: AssistantTaskSelection; disabled: boolean; onChange: (patch: Partial<AssistantTaskSelection>) => void; onRemove: () => void };

export function AssistantTaskEditor({ task, disabled, onChange, onRemove }: AssistantTaskEditorProps): React.ReactElement {
  const { locale } = useLocale();
  const copy = ASSISTANT_COPY[locale];
  const fieldsDisabled = disabled || !task.selected;
  return <SoftPanel>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <FieldLabel className="flex items-center gap-2"><input type="checkbox" checked={task.selected} disabled={disabled} onChange={(event) => onChange({ selected: event.target.checked })} />{copy.select}</FieldLabel>
      <GhostButton type="button" disabled={disabled} onClick={onRemove}><Trash2 className="h-4 w-4" />{copy.remove}</GhostButton>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <FieldLabel className="block sm:col-span-2">{copy.titleField}<TextInput className="mt-1" maxLength={240} value={task.title} disabled={fieldsDisabled} onChange={(event) => onChange({ title: event.target.value })} /></FieldLabel>
      <FieldLabel className="block sm:col-span-2">{copy.descriptionField}<TextArea className="mt-1" rows={2} maxLength={3000} value={task.description ?? ""} disabled={fieldsDisabled} onChange={(event) => onChange({ description: event.target.value || null })} /></FieldLabel>
      <FieldLabel className="block">{copy.taskDate}<TextInput className="mt-1" type="date" value={task.date ?? ""} disabled={fieldsDisabled} onChange={(event) => onChange({ date: event.target.value || null })} /></FieldLabel>
      <FieldLabel className="block">{copy.minutes}<TextInput className="mt-1" type="number" min={0} max={10080} step={1} value={Number.isNaN(task.estimatedMinutes) ? "" : task.estimatedMinutes} disabled={fieldsDisabled} onChange={(event) => onChange({ estimatedMinutes: event.target.value === "" ? Number.NaN : Number(event.target.value) })} /></FieldLabel>
      <FieldLabel className="block">{copy.start}<TextInput className="mt-1" type="time" value={task.startTime ?? ""} disabled={fieldsDisabled} onChange={(event) => onChange({ startTime: event.target.value || null })} /></FieldLabel>
      <FieldLabel className="block">{copy.end}<TextInput className="mt-1" type="time" value={task.endTime ?? ""} disabled={fieldsDisabled} onChange={(event) => onChange({ endTime: event.target.value || null })} /></FieldLabel>
      <FieldLabel className="block">{copy.importance}<SelectInput className="mt-1" value={task.importance} disabled={fieldsDisabled} onChange={(event) => { const importance = event.target.value; if (importance === "low" || importance === "medium" || importance === "high") onChange({ importance }); }}><option value="low">{copy.low}</option><option value="medium">{copy.medium}</option><option value="high">{copy.high}</option></SelectInput></FieldLabel>
      <FieldLabel className="flex items-center gap-2"><input type="checkbox" checked={task.productive} disabled={fieldsDisabled} onChange={(event) => onChange({ productive: event.target.checked })} />{copy.productive}</FieldLabel>
    </div>
  </SoftPanel>;
}
