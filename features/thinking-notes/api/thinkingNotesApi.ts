import {
  expectJsonObject,
  expectNullableString,
  expectString,
  requestJson
} from "@/lib/http/apiClient";
import type { Tag } from "@/features/shared/domain/tagCompany";
import type { ThinkingNote, ThinkingNoteDraft, ThinkingNoteTaskRef } from "../domain/thinkingNote";

export function listThinkingNotes(signal?: AbortSignal): Promise<ThinkingNote[]> {
  return requestJson("/api/thinking-notes", parseThinkingNotesResponse, { signal });
}

export function createThinkingNote(draft: ThinkingNoteDraft): Promise<ThinkingNote> {
  return requestJson("/api/thinking-notes", parseThinkingNoteResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(draft))
  });
}

export function updateThinkingNote(id: string, draft: ThinkingNoteDraft): Promise<ThinkingNote> {
  return requestJson("/api/thinking-notes", parseThinkingNoteResponse, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...toPayload(draft) })
  });
}

export function deleteThinkingNote(id: string): Promise<void> {
  return requestJson(`/api/thinking-notes?id=${encodeURIComponent(id)}`, () => undefined, {
    method: "DELETE"
  });
}

function toPayload(draft: ThinkingNoteDraft) {
  return {
    title: draft.title.trim() || null,
    content: draft.content,
    reminderAt: draft.reminderAt ? new Date(draft.reminderAt).toISOString() : null,
    tagNames: draft.tagNames,
    taskIds: draft.taskIds
  };
}

function parseThinkingNotesResponse(payload: unknown): ThinkingNote[] {
  const response = expectJsonObject(payload, "thinking notes response");
  if (!Array.isArray(response.notes)) throw new Error("thinking notes response.notes must be an array");
  return response.notes.map((note, index) => parseThinkingNote(note, `thinking notes response.notes[${index}]`));
}

function parseThinkingNoteResponse(payload: unknown): ThinkingNote {
  const response = expectJsonObject(payload, "thinking note response");
  return parseThinkingNote(response.note, "thinking note response.note");
}

function parseThinkingNote(payload: unknown, context: string): ThinkingNote {
  const note = expectJsonObject(payload, context);
  return {
    id: expectString(note.id, `${context}.id`),
    title: expectNullableString(note.title, `${context}.title`),
    content: expectString(note.content, `${context}.content`),
    reminderAt: expectNullableString(note.reminderAt, `${context}.reminderAt`),
    tags: parseTags(note.tags, `${context}.tags`),
    tasks: parseTaskRefs(note.tasks, `${context}.tasks`),
    createdAt: expectString(note.createdAt, `${context}.createdAt`),
    updatedAt: expectString(note.updatedAt, `${context}.updatedAt`)
  };
}

function parseTags(payload: unknown, context: string): Tag[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((tag, index) => {
    const record = expectJsonObject(tag, `${context}[${index}]`);
    return {
      id: expectString(record.id, `${context}[${index}].id`),
      name: expectString(record.name, `${context}[${index}].name`),
      color: expectString(record.color, `${context}[${index}].color`),
      usageCount: 1
    };
  });
}

function parseTaskRefs(payload: unknown, context: string): ThinkingNoteTaskRef[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((task, index) => {
    const record = expectJsonObject(task, `${context}[${index}]`);
    return {
      id: expectString(record.id, `${context}[${index}].id`),
      title: expectString(record.title, `${context}[${index}].title`)
    };
  });
}
