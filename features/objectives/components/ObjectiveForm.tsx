import type { FormEventHandler } from "react";
import { formatDuration } from "@/components/DurationInput";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
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
  const { translate } = useLocale();

  return (
    <form id={OBJECTIVE_FORM_ID} onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm leading-6 text-muted">{translate("objectives.form.hint")}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel htmlFor="objective-title">{translate("objectives.form.title")}</FieldLabel>
          <TextInput
            id="objective-title"
            required
            autoFocus
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="mt-2"
            placeholder={translate("objectives.form.titlePlaceholder")}
          />
        </div>
        <div>
          <FieldLabel htmlFor="objective-horizon">{translate("objectives.form.horizon")}</FieldLabel>
          <SelectInput
            id="objective-horizon"
            value={draft.horizon}
            onChange={(event) => onChange({ horizon: event.target.value as ObjectiveDraft["horizon"] })}
            className="mt-2 w-full"
          >
            {objectiveHorizons.map((horizon) => (
              <option key={horizon} value={horizon}>{translate(`objectives.horizon.${horizon}`)}</option>
            ))}
          </SelectInput>
        </div>
        <div className="md:col-span-2">
          <FieldLabel htmlFor="objective-next-action">{translate("objectives.form.nextAction")}</FieldLabel>
          <TextArea
            id="objective-next-action"
            value={draft.nextAction}
            onChange={(event) => onChange({ nextAction: event.target.value })}
            className="mt-2 min-h-[84px]"
            placeholder={translate("objectives.form.nextActionPlaceholder")}
            aria-describedby="objective-next-action-help"
          />
          <p id="objective-next-action-help" className="mt-2 text-xs leading-5 text-muted">
            {translate("objectives.form.nextActionHelp")}
          </p>
        </div>
      </div>

      <details className="rounded-[22px] bg-shell/50 p-4 ring-1 ring-line">
        <summary className="focus-ring cursor-pointer text-sm font-medium text-ink">
          {translate("objectives.form.details")}
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="objective-kind">{translate("objectives.form.kind")}</FieldLabel>
            <SelectInput
              id="objective-kind"
              value={draft.kind}
              onChange={(event) => onChange({ kind: event.target.value as ObjectiveDraft["kind"] })}
              className="mt-2 w-full"
            >
              {objectiveKinds.map((kind) => (
                <option key={kind} value={kind}>{translate(`objectives.kind.${kind}`)}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="objective-status">{translate("objectives.form.status")}</FieldLabel>
            <SelectInput
              id="objective-status"
              value={draft.status}
              onChange={(event) => onChange({ status: event.target.value as ObjectiveDraft["status"] })}
              className="mt-2 w-full"
            >
              {objectiveStatuses.map((status) => (
                <option key={status} value={status}>{translate(`objectives.status.${status}`)}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="objective-priority">{translate("objectives.form.priority")}</FieldLabel>
            <SelectInput
              id="objective-priority"
              value={draft.priority}
              onChange={(event) => onChange({ priority: event.target.value as ObjectiveDraft["priority"] })}
              className="mt-2 w-full"
            >
              {objectivePriorities.map((priority) => (
                <option key={priority} value={priority}>{translate(`objectives.priority.${priority}`)}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="objective-parent">{translate("objectives.form.parent")}</FieldLabel>
            <SelectInput
              id="objective-parent"
              value={draft.parentId}
              onChange={(event) => onChange({ parentId: event.target.value })}
              className="mt-2 w-full"
            >
              <option value="">{translate("objectives.form.noParent")}</option>
              {objectives
                .filter((objective) => objective.id !== draft.id)
                .map((objective) => (
                  <option key={objective.id} value={objective.id}>
                    {objective.title} · {translate(`objectives.horizon.${objective.horizon}`)}
                  </option>
                ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="objective-target-date">{translate("objectives.form.targetDate")}</FieldLabel>
            <TextInput
              id="objective-target-date"
              type="date"
              value={draft.targetDate}
              onChange={(event) => onChange({ targetDate: event.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <FieldLabel htmlFor="objective-week">{translate("objectives.form.week")}</FieldLabel>
            <TextInput
              id="objective-week"
              type="week"
              value={draft.weekId}
              onChange={(event) => onChange({ weekId: event.target.value })}
              className="mt-2"
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel htmlFor="objective-summary">{translate("objectives.form.summary")}</FieldLabel>
            <TextArea
              id="objective-summary"
              value={draft.summary}
              onChange={(event) => onChange({ summary: event.target.value })}
              className="mt-2 min-h-[96px]"
              placeholder={translate("objectives.form.summaryPlaceholder")}
            />
          </div>
        </div>
      </details>

      <details className="rounded-[22px] bg-shell/50 p-4 ring-1 ring-line">
        <summary className="focus-ring cursor-pointer text-sm font-medium text-ink">
          {translate("objectives.form.linkedTasks")}
          <Pill className="ml-3">{translate("objectives.form.selected", { count: draft.linkedTaskIds.length })}</Pill>
        </summary>
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
          {taskOptions.length === 0 ? (
            <p className="text-sm text-muted">{translate("objectives.form.noTasks")}</p>
          ) : (
            taskOptions.map((task) => {
              const isTaskLinked = draft.linkedTaskIds.includes(task.id);
              return (
                <label key={task.id} className="flex items-start gap-3 rounded-[18px] bg-shell px-3 py-2 ring-1 ring-line">
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
                    <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {task.date ? `${task.date} · ` : ""}{formatDuration(task.estimatedMinutes)}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </details>
    </form>
  );
}
