import type { FormEventHandler } from "react";
import { formatDuration } from "@/components/DurationInput";
import {
  FieldLabel,
  Pill,
  SelectInput,
  TextArea,
  TextInput
} from "@/components/ui";
import type {
  ObjectiveSummary,
  ObjectiveTask
} from "@/features/objectives/domain/objective";
import {
  objectiveHorizons,
  objectiveKinds,
  objectivePriorities,
  objectiveStatuses,
  type ObjectiveDraft
} from "@/features/objectives/domain/objectiveUi";

export const OBJECTIVE_FORM_ID = "objective-form";

type ObjectiveFormProps = {
  draft: ObjectiveDraft;
  objectives: ObjectiveSummary[];
  taskOptions: ObjectiveTask[];
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function ObjectiveForm({
  draft,
  objectives,
  taskOptions,
  onChange,
  onSubmit
}: ObjectiveFormProps) {
  return (
    <form id={OBJECTIVE_FORM_ID} onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="mt-2"
            placeholder="What matters here?"
          />
        </div>
        <div>
          <FieldLabel>Kind</FieldLabel>
          <SelectInput
            value={draft.kind}
            onChange={(event) => onChange({ kind: event.target.value as ObjectiveDraft["kind"] })}
            className="mt-2 w-full"
          >
            {objectiveKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Horizon</FieldLabel>
          <SelectInput
            value={draft.horizon}
            onChange={(event) => onChange({ horizon: event.target.value as ObjectiveDraft["horizon"] })}
            className="mt-2 w-full"
          >
            {objectiveHorizons.map((horizon) => <option key={horizon} value={horizon}>{horizon}</option>)}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <SelectInput
            value={draft.status}
            onChange={(event) => onChange({ status: event.target.value as ObjectiveDraft["status"] })}
            className="mt-2 w-full"
          >
            {objectiveStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <SelectInput
            value={draft.priority}
            onChange={(event) => onChange({ priority: event.target.value as ObjectiveDraft["priority"] })}
            className="mt-2 w-full"
          >
            {objectivePriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Parent</FieldLabel>
          <SelectInput
            value={draft.parentId}
            onChange={(event) => onChange({ parentId: event.target.value })}
            className="mt-2 w-full"
          >
            <option value="">No parent</option>
            {objectives
              .filter((objective) => objective.id !== draft.id)
              .map((objective) => (
                <option key={objective.id} value={objective.id}>
                  {objective.title} · {objective.horizon}
                </option>
              ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Target date</FieldLabel>
          <TextInput
            type="date"
            value={draft.targetDate}
            onChange={(event) => onChange({ targetDate: event.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <FieldLabel>Week anchor</FieldLabel>
          <TextInput
            value={draft.weekId}
            onChange={(event) => onChange({ weekId: event.target.value })}
            className="mt-2"
            placeholder="2026-W26"
          />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Summary</FieldLabel>
          <TextArea
            value={draft.summary}
            onChange={(event) => onChange({ summary: event.target.value })}
            className="mt-2 min-h-[96px]"
            placeholder="Why does this matter?"
          />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Next action</FieldLabel>
          <TextArea
            value={draft.nextAction}
            onChange={(event) => onChange({ nextAction: event.target.value })}
            className="mt-2 min-h-[84px]"
            placeholder="What is the very next concrete move?"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <FieldLabel>Linked tasks</FieldLabel>
          <Pill>{draft.linkedTaskIds.length} selected</Pill>
        </div>
        <div className="grid gap-2 rounded-[22px] bg-white/[0.03] p-3 ring-1 ring-white/6">
          {taskOptions.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks available yet. Add a few tasks, then link them back to this objective.</p>
          ) : (
            taskOptions.map((task) => {
              const isTaskLinked = draft.linkedTaskIds.includes(task.id);
              return (
                <label key={task.id} className="flex items-start gap-3 rounded-[18px] bg-white/[0.03] px-3 py-2 ring-1 ring-white/6">
                  <input
                    type="checkbox"
                    checked={isTaskLinked}
                    onChange={(event) => onChange({
                      linkedTaskIds: event.target.checked
                        ? [...draft.linkedTaskIds, task.id]
                        : draft.linkedTaskIds.filter((taskId) => taskId !== task.id)
                    })}
                    className="mt-1 h-4 w-4 accent-accent"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.date} · {task.importance} · {task.status} · {formatDuration(task.estimatedMinutes)}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </form>
  );
}
