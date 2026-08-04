"use client";

import { AlertTriangle, BellRing, Lightbulb, Plus, Trash2 } from "lucide-react";
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
import { listTags } from "@/features/shared/api/tagsApi";
import type { Tag } from "@/features/shared/domain/tagCompany";
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
        if (!requestController.signal.aborted) setPageError(readApiErrorMessage(error, "Unable to load notes."));
      });
    void listTags(requestController.signal).then(setTags).catch(() => undefined);
    void listTodoTasks({ date: today, scope: "all", signal: requestController.signal })
      .then(setTasks)
      .catch(() => undefined);
    return () => requestController.abort();
  }, [today]);

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
      setDrawerError("Write something before saving.");
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
      setDrawer(null);
    } catch (error: unknown) {
      setDrawerError(readApiErrorMessage(error, "Unable to save the note."));
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note: ThinkingNote) {
    if (typeof window !== "undefined" && !window.confirm(`Delete this note?`)) return;
    const previousNotes = notes;
    setNotes((current) => current.filter((item) => item.id !== note.id));
    try {
      await deleteThinkingNote(note.id);
    } catch (error: unknown) {
      setNotes(previousNotes);
      setPageError(readApiErrorMessage(error, "Unable to delete the note."));
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
        eyebrow="Thinking"
        title="Notes"
        detail="Capture a thought, tag it, link it to a task, and set a reminder if it needs to resurface."
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New note
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
            Reminders
          </h2>
          <div className="space-y-2">
            {dueReminders.map((note) => (
              <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={removeNote} now={now} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        {dueReminders.length > 0 ? (
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">All notes</h2>
        ) : null}
        {notes.length === 0 ? (
          <SoftPanel className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <Lightbulb className="h-6 w-6 text-muted" />
            <p className="mt-3 text-lg font-medium text-ink">No notes yet.</p>
            <p className="mt-2 max-w-sm text-sm text-muted">Jot down a thought as soon as it happens.</p>
            <SecondaryButton className="mt-5" onClick={openCreate}>
              Write a note
            </SecondaryButton>
          </SoftPanel>
        ) : (
          <div className="space-y-2">
            {otherNotes.map((note) => (
              <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={removeNote} now={now} />
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? "Edit note" : "New note"}
        onClose={() => setDrawer(null)}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setDrawer(null)}>Cancel</SecondaryButton>
            <PrimaryButton form="thinking-note-form" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save note"}
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
              <FieldLabel>Title (optional)</FieldLabel>
              <TextInput
                value={drawer.draft.title}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)}
                className="mt-2"
                placeholder="Short summary"
              />
            </div>
            <div>
              <FieldLabel>Note</FieldLabel>
              <TextArea
                value={drawer.draft.content}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, content: event.target.value } } : current)}
                className="mt-2 min-h-[160px]"
                placeholder="Write freely..."
              />
            </div>
            <TagsField
              value={drawer.draft.tagNames}
              onChange={(tagNames) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, tagNames } } : current)}
              tags={tags}
            />
            <div>
              <FieldLabel>Reminder (optional)</FieldLabel>
              <TextInput
                type="datetime-local"
                value={drawer.draft.reminderAt}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, reminderAt: event.target.value } } : current)}
                className="mt-2"
              />
            </div>
            <div>
              <FieldLabel>Linked tasks (optional)</FieldLabel>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-shell p-2 ring-1 ring-line">
                {tasks.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted">No tasks to link yet.</p>
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
  now
}: {
  note: ThinkingNote;
  onEdit: (note: ThinkingNote) => void;
  onDelete: (note: ThinkingNote) => void;
  now: number;
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
                {new Date(note.reminderAt).toLocaleString()}
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
