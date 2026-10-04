import type { FormEventHandler } from "react";
import { Trash2 } from "lucide-react";
import { Drawer, GhostButton, PrimaryButton, SecondaryButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { ObjectiveSummary, ObjectiveTask } from "@/features/objectives/domain/objective";
import type { ObjectiveDraft, WeeklyBlockDraft } from "@/features/objectives/domain/objectiveUi";
import { ObjectiveForm, OBJECTIVE_FORM_ID } from "@/features/objectives/components/ObjectiveForm";
import { WeeklyBlockForm, WEEKLY_BLOCK_FORM_ID } from "@/features/objectives/components/WeeklyBlockForm";

export type ObjectiveEditorState =
  | { type: "objective"; mode: "create" | "edit"; draft: ObjectiveDraft }
  | { type: "weekly_block"; mode: "create" | "edit"; draft: WeeklyBlockDraft }
  | null;

type ObjectiveEditorDrawerProps = {
  editor: ObjectiveEditorState;
  isSaving: boolean;
  objectives: ObjectiveSummary[];
  taskOptions: ObjectiveTask[];
  onClose: () => void;
  onDelete: () => void;
  onObjectiveDraftChange: (patch: Partial<ObjectiveDraft>) => void;
  onWeeklyBlockDraftChange: (patch: Partial<WeeklyBlockDraft>) => void;
  onSaveObjective: FormEventHandler<HTMLFormElement>;
  onSaveWeeklyBlock: FormEventHandler<HTMLFormElement>;
};

export function ObjectiveEditorDrawer({
  editor,
  isSaving,
  objectives,
  taskOptions,
  onClose,
  onDelete,
  onObjectiveDraftChange,
  onWeeklyBlockDraftChange,
  onSaveObjective,
  onSaveWeeklyBlock
}: ObjectiveEditorDrawerProps) {
  const { translate } = useLocale();
  const isObjectiveEditor = editor?.type === "objective";
  const isEditMode = editor?.mode === "edit";
  const formId = isObjectiveEditor ? OBJECTIVE_FORM_ID : WEEKLY_BLOCK_FORM_ID;
  const title = isObjectiveEditor
    ? translate(isEditMode ? "objectives.editor.edit" : "objectives.editor.create")
    : translate(isEditMode ? "objectives.editor.editBlock" : "objectives.editor.createBlock");
  const description = isObjectiveEditor
    ? translate("objectives.editor.description")
    : translate("objectives.editor.blockDescription");
  const isTitleMissing = editor ? !editor.draft.title.trim() : true;

  return (
    <Drawer
      open={Boolean(editor)}
      title={title}
      description={description}
      onClose={onClose}
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          {isEditMode ? (
            <GhostButton onClick={onDelete} className="rounded-2xl bg-risk/10 px-3 text-risk ring-1 ring-risk/15">
              <Trash2 className="h-4 w-4" />
              {translate("objectives.editor.delete")}
            </GhostButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose}>{translate("objectives.editor.cancel")}</SecondaryButton>
            <PrimaryButton type="submit" form={formId} disabled={isSaving || isTitleMissing}>
              {translate(isSaving
                ? "objectives.editor.saving"
                : isEditMode
                  ? "objectives.editor.save"
                  : isObjectiveEditor
                    ? "objectives.editor.submit"
                    : "objectives.editor.submitBlock")}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      {editor?.type === "objective" ? (
        <ObjectiveForm
          key={editor.draft.id ?? "new-objective"}
          draft={editor.draft}
          objectives={objectives}
          taskOptions={taskOptions}
          onChange={onObjectiveDraftChange}
          onSubmit={onSaveObjective}
        />
      ) : null}

      {editor?.type === "weekly_block" ? (
        <WeeklyBlockForm
          draft={editor.draft}
          objectives={objectives}
          onChange={onWeeklyBlockDraftChange}
          onSubmit={onSaveWeeklyBlock}
        />
      ) : null}
    </Drawer>
  );
}
