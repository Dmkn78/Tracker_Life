import type { FormEventHandler } from "react";
import { DurationInput } from "@/components/DurationInput";
import {
  FieldLabel,
  SelectInput,
  TextArea,
  TextInput
} from "@/components/ui";
import type { ObjectiveSummary } from "@/features/objectives/domain/objective";
import {
  type WeeklyBlockDraft,
  weeklyPlanCategories
} from "@/features/objectives/domain/objectiveUi";

export const WEEKLY_BLOCK_FORM_ID = "weekly-block-form";

type WeeklyBlockFormProps = {
  draft: WeeklyBlockDraft;
  objectives: ObjectiveSummary[];
  onChange: (patch: Partial<WeeklyBlockDraft>) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function WeeklyBlockForm({
  draft,
  objectives,
  onChange,
  onSubmit
}: WeeklyBlockFormProps) {
  return (
    <form id={WEEKLY_BLOCK_FORM_ID} onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="mt-2"
            placeholder="Focused work block, training, review..."
          />
        </div>
        <div>
          <FieldLabel>Objective / project</FieldLabel>
          <SelectInput
            value={draft.objectiveId}
            onChange={(event) => onChange({ objectiveId: event.target.value })}
            className="mt-2 w-full"
          >
            <option value="">Unlinked block</option>
            {objectives.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title}
              </option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <SelectInput
            value={draft.category}
            onChange={(event) => onChange({ category: event.target.value as WeeklyBlockDraft["category"] })}
            className="mt-2 w-full"
          >
            {weeklyPlanCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextInput
            type="date"
            value={draft.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <FieldLabel>Flexible</FieldLabel>
          <label className="mt-2 flex h-11 items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 text-sm text-slate-200 ring-1 ring-white/8">
            <input
              type="checkbox"
              checked={draft.flexible}
              onChange={(event) => onChange({ flexible: event.target.checked })}
              className="h-4 w-4 accent-accent"
            />
            This block can move if the week changes
          </label>
        </div>
        <div>
          <FieldLabel>Start time</FieldLabel>
          <TextInput
            type="time"
            value={draft.startTime}
            onChange={(event) => onChange({ startTime: event.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <FieldLabel>End time</FieldLabel>
          <TextInput
            type="time"
            value={draft.endTime}
            onChange={(event) => onChange({ endTime: event.target.value })}
            className="mt-2"
          />
        </div>
        <DurationInput
          label="Planned duration"
          value={draft.durationMinutes}
          onChange={(durationMinutes) => onChange({ durationMinutes })}
          showStored={false}
        />
        <div className="md:col-span-2">
          <FieldLabel>Note</FieldLabel>
          <TextArea
            value={draft.note}
            onChange={(event) => onChange({ note: event.target.value })}
            className="mt-2 min-h-[84px]"
            placeholder="Optional note, constraints, or success condition."
          />
        </div>
      </div>
    </form>
  );
}
