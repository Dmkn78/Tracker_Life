"use client";

import { AlertTriangle, BellRing, Hash, Lightbulb, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TagsField } from "@/components/TagCompanyFields";
import {
  Drawer,
  FieldLabel,
  GhostButton,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SoftPanel,
  TextArea,
  TextInput
} from "@/components/ui";
import { deleteTag, listTags } from "@/features/shared/api/tagsApi";
import type { Tag } from "@/features/shared/domain/tagCompany";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import {
  createThinkingNote,
  deleteThinkingNote,
  listThinkingNotes,
  updateThinkingNote
} from "@/features/thinking-notes/api/thinkingNotesApi";
import {
  emptyThinkingNoteDraft,
  type ThinkingNote,
  type ThinkingNoteDraft
} from "@/features/thinking-notes/domain/thinkingNote";
import { listTodoTasks } from "@/features/todo/api/todoApi";
import type { TodoTask } from "@/features/todo/domain/todoTask";
import { ApiError } from "@/lib/http/apiClient";

export function ThinkingNotesClient({ today }: { today: string }) {
  const { locale } = useLocale();
  const copy = THINKING_COPY[locale];
  const [notes, setNotes] = useState<ThinkingNote[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; id?: string; draft: ThinkingNoteDraft } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const requestController = new AbortController();
    setPageError(null);
    void listThinkingNotes(requestController.signal)
      .then(setNotes)
      .catch((error: unknown) => {
        if (!requestController.signal.aborted) setPageError(readApiErrorMessage(error, copy.loadError));
      });
    void listTags(requestController.signal).then(setTags).catch(() => undefined);
    void listTodoTasks({ date: today, scope: "all", signal: requestController.signal })
      .then(setTasks)
      .catch(() => undefined);
    return () => requestController.abort();
  }, [copy.loadError, today]);

  function openCreate() {
    setDrawerError(null);
    setDrawer({ mode: "create", draft: emptyThinkingNoteDraft() });
  }

  function openEdit(note: ThinkingNote) {
    setDrawerError(null);
    setDrawer({
      mode: "edit",
      id: note.id,
      draft: {
        title: note.title ?? "",
        content: note.content,
        reminderAt: note.reminderAt ? toDatetimeLocal(note.reminderAt) : "",
        tagNames: note.tags.map((tag) => tag.name),
        taskIds: note.tasks.map((task) => task.id)
      }
    });
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || !drawer.draft.content.trim()) {
      setDrawerError(copy.contentRequired);
      return;
    }
    setSaving(true);
    setDrawerError(null);
    try {
      const saved =
        drawer.mode === "edit" && drawer.id
          ? await updateThinkingNote(drawer.id, drawer.draft)
          : await createThinkingNote(drawer.draft);
      setNotes((current) => {
        const withoutSaved = current.filter((note) => note.id !== saved.id);
        return [...withoutSaved, saved].sort(sortNotes);
      });
      void listTags().then(setTags).catch(() => undefined);
      setDrawer(null);
    } catch (error: unknown) {
      setDrawerError(readApiErrorMessage(error, copy.saveError));
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note: ThinkingNote) {
    if (typeof window !== "undefined" && !window.confirm(copy.confirmDeleteNote)) return;
    const previousNotes = notes;
    setNotes((current) => current.filter((item) => item.id !== note.id));
    try {
      await deleteThinkingNote(note.id);
    } catch (error: unknown) {
      setNotes(previousNotes);
      setPageError(readApiErrorMessage(error, copy.deleteNoteError));
    }
  }

  async function removeUnusedTag(tag: Tag): Promise<void> {
    if ((tag.usageCount ?? 0) > 0 || saving) return;
    if (typeof window !== "undefined" && !window.confirm(copy.confirmDeleteTag.replace("{name}", tag.name))) return;
    setSaving(true);
    setPageError(null);
    try {
      await deleteTag(tag.id);
      setTags((current) => current.filter((item) => item.id !== tag.id));
    } catch (error: unknown) {
      setPageError(readApiErrorMessage(error, copy.deleteTagError));
    } finally {
      setSaving(false);
    }
  }

  const now = Date.now();
  const dueReminders = notes
    .filter((note) => note.reminderAt)
    .sort((a, b) => (a.reminderAt ?? "").localeCompare(b.reminderAt ?? ""));
  const otherNotes = notes.filter((note) => !note.reminderAt).sort(sortNotes);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        detail={copy.detail}
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {copy.newNote}
          </PrimaryButton>
        }
      />

      {pageError ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {pageError}
        </p>
      ) : null}

      {dueReminders.length > 0 ? (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <BellRing className="h-4 w-4" />
            {copy.reminders}
          </h2>
          <div className="space-y-2">
            {dueReminders.map((note) => (
              <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={removeNote} now={now} locale={locale} deleteLabel={copy.deleteNote} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        {dueReminders.length > 0 ? (
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{copy.allNotes}</h2>
        ) : null}
        {notes.length === 0 ? (
          <SoftPanel className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <Lightbulb className="h-6 w-6 text-muted" />
            <p className="mt-3 text-lg font-medium text-ink">{copy.noNotes}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">{copy.noNotesDetail}</p>
            <SecondaryButton className="mt-5" onClick={openCreate}>
              {copy.writeNote}
            </SecondaryButton>
          </SoftPanel>
        ) : (
          <div className="space-y-2">
            {otherNotes.map((note) => (
              <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={removeNote} now={now} locale={locale} deleteLabel={copy.deleteNote} />
            ))}
          </div>
        )}
      </div>

      <SoftPanel className="p-4">
        <div className="flex items-start gap-3">
          <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-ink">{copy.tagManager}</h2>
            <p className="mt-1 text-sm text-muted">{copy.tagManagerDetail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.length === 0 ? <span className="text-sm text-muted">{copy.noTags}</span> : tags.map((tag) => (
                <span key={tag.id} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-panel2/60 pl-3 pr-1 ring-1 ring-line">
                  <span className="text-sm text-ink">{tag.name}</span>
                  <span className="text-xs text-muted">({tag.usageCount ?? 0})</span>
                  <GhostButton
                    type="button"
                    disabled={saving || (tag.usageCount ?? 0) > 0}
                    onClick={() => removeUnusedTag(tag)}
                    aria-label={copy.deleteTag.replace("{name}", tag.name)}
                    title={(tag.usageCount ?? 0) > 0 ? copy.tagInUse : copy.deleteTag.replace("{name}", tag.name)}
                    className="min-h-7 min-w-7 rounded-full p-1 text-risk disabled:text-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </GhostButton>
                </span>
              ))}
            </div>
          </div>
        </div>
      </SoftPanel>

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? copy.editNote : copy.newNote}
        onClose={() => setDrawer(null)}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setDrawer(null)}>{copy.cancel}</SecondaryButton>
            <PrimaryButton form="thinking-note-form" type="submit" disabled={saving}>
              {saving ? copy.saving : copy.saveNote}
            </PrimaryButton>
          </div>
        }
      >
        {drawer ? (
          <form id="thinking-note-form" onSubmit={saveNote} className="space-y-4">
            {drawerError ? (
              <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {drawerError}
              </p>
            ) : null}
            <div>
              <FieldLabel>{copy.optionalTitle}</FieldLabel>
              <TextInput
                value={drawer.draft.title}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)}
                className="mt-2"
                placeholder={copy.shortSummary}
              />
            </div>
            <div>
              <FieldLabel>{copy.note}</FieldLabel>
              <TextArea
                value={drawer.draft.content}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, content: event.target.value } } : current)}
                className="mt-2 min-h-[160px]"
                placeholder={copy.writeFreely}
              />
            </div>
            <TagsField
              value={drawer.draft.tagNames}
              onChange={(tagNames) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, tagNames } } : current)}
              tags={tags}
              label={copy.tags}
              placeholder={copy.addTag}
              removeTagLabel={(name) => copy.detachTag.replace("{name}", name)}
            />
            <div>
              <FieldLabel>{copy.optionalReminder}</FieldLabel>
              <TextInput
                type="datetime-local"
                value={drawer.draft.reminderAt}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, reminderAt: event.target.value } } : current)}
                className="mt-2"
              />
            </div>
            <div>
              <FieldLabel>{copy.optionalTasks}</FieldLabel>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-shell p-2 ring-1 ring-line">
                {tasks.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted">{copy.noTasks}</p>
                ) : (
                  tasks.map((task) => (
                    <label key={task.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-ink hover:bg-panel2/60">
                      <input
                        type="checkbox"
                        checked={drawer.draft.taskIds.includes(task.id)}
                        onChange={(event) =>
                          setDrawer((current) => {
                            if (!current) return current;
                            const taskIds = event.target.checked
                              ? [...current.draft.taskIds, task.id]
                              : current.draft.taskIds.filter((id) => id !== task.id);
                            return { ...current, draft: { ...current.draft, taskIds } };
                          })
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      <span className="truncate">{task.title}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
  now,
  locale,
  deleteLabel
}: {
  note: ThinkingNote;
  onEdit: (note: ThinkingNote) => void;
  onDelete: (note: ThinkingNote) => void;
  now: number;
  locale: "en" | "fr";
  deleteLabel: string;
}) {
  const overdue = note.reminderAt ? new Date(note.reminderAt).getTime() < now : false;
  return (
    <SoftPanel className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button type="button" onClick={() => onEdit(note)} className="min-w-0 flex-1 text-left">
          {note.title ? <p className="text-lg font-semibold text-ink">{note.title}</p> : null}
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{note.content}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {note.reminderAt ? (
              <Pill className={overdue ? "bg-risk/12 text-risk ring-risk/15" : "bg-accent/12 text-accent ring-accent/15"}>
                {overdue ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : <BellRing className="mr-1 inline h-3 w-3" />}
                {new Date(note.reminderAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
              </Pill>
            ) : null}
            {note.tags.map((tag) => (
              <Pill key={tag.id} style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
                {tag.name}
              </Pill>
            ))}
            {note.tasks.map((task) => (
              <Pill key={task.id}>{task.title}</Pill>
            ))}
          </div>
        </button>
        <GhostButton
          onClick={() => onDelete(note)}
          aria-label={deleteLabel}
          className="min-h-9 min-w-9 shrink-0 rounded-2xl bg-panel2/50 px-3 text-risk ring-1 ring-line hover:text-risk"
        >
          <Trash2 className="h-4 w-4" />
        </GhostButton>
      </div>
    </SoftPanel>
  );
}

function sortNotes(a: ThinkingNote, b: ThinkingNote) {
  return b.createdAt.localeCompare(a.createdAt);
}

function toDatetimeLocal(isoString: string) {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const THINKING_COPY = {
  en: {
    eyebrow: "Thinking", title: "Notes", detail: "Capture a thought, tag it, link it to a task, and set a reminder when it should resurface.", newNote: "New note", reminders: "Reminders", allNotes: "All notes", noNotes: "No notes yet.", noNotesDetail: "Jot down a thought as soon as it happens.", writeNote: "Write a note", editNote: "Edit note", cancel: "Cancel", saving: "Saving...", saveNote: "Save note", optionalTitle: "Title (optional)", shortSummary: "Short summary", note: "Note", writeFreely: "Write freely...", tags: "Tags", addTag: "Add a tag", detachTag: "Detach {name} from this note", optionalReminder: "Reminder (optional)", optionalTasks: "Linked tasks (optional)", noTasks: "No tasks to link yet.", tagManager: "Tag manager", tagManagerDetail: "Detach a tag from every note or task before deleting it permanently. The number is its current usage.", noTags: "No saved tags.", tagInUse: "This tag is still in use", deleteTag: "Delete {name} permanently", confirmDeleteTag: "Delete the unused tag {name} permanently?", confirmDeleteNote: "Delete this note?", deleteNote: "Delete note", loadError: "Unable to load notes.", contentRequired: "Write something before saving.", saveError: "Unable to save the note.", deleteNoteError: "Unable to delete the note.", deleteTagError: "Unable to delete the tag. Detach it everywhere first."
  },
  fr: {
    eyebrow: "Réflexion", title: "Notes", detail: "Capturez une idée, ajoutez des tags, liez-la à une tâche et programmez son rappel.", newNote: "Nouvelle note", reminders: "Rappels", allNotes: "Toutes les notes", noNotes: "Aucune note.", noNotesDetail: "Consignez une idée dès qu’elle apparaît.", writeNote: "Écrire une note", editNote: "Modifier la note", cancel: "Annuler", saving: "Enregistrement…", saveNote: "Enregistrer", optionalTitle: "Titre (facultatif)", shortSummary: "Résumé court", note: "Note", writeFreely: "Écrivez librement…", tags: "Tags", addTag: "Ajouter un tag", detachTag: "Détacher {name} de cette note", optionalReminder: "Rappel (facultatif)", optionalTasks: "Tâches liées (facultatif)", noTasks: "Aucune tâche à lier.", tagManager: "Gestion des tags", tagManagerDetail: "Détachez un tag de toutes les notes et tâches avant de le supprimer définitivement. Le nombre indique son utilisation actuelle.", noTags: "Aucun tag enregistré.", tagInUse: "Ce tag est encore utilisé", deleteTag: "Supprimer définitivement {name}", confirmDeleteTag: "Supprimer définitivement le tag inutilisé {name} ?", confirmDeleteNote: "Supprimer cette note ?", deleteNote: "Supprimer la note", loadError: "Impossible de charger les notes.", contentRequired: "Écrivez du contenu avant d’enregistrer.", saveError: "Impossible d’enregistrer la note.", deleteNoteError: "Impossible de supprimer la note.", deleteTagError: "Impossible de supprimer le tag. Détachez-le d’abord partout."
  }
} as const;
