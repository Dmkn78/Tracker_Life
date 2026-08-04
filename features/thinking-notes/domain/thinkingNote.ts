import type { Tag } from "@/features/shared/domain/tagCompany";

export type ThinkingNoteTaskRef = {
  id: string;
  title: string;
};

export type ThinkingNote = {
  id: string;
  title: string | null;
  content: string;
  reminderAt: string | null;
  tags: Tag[];
  tasks: ThinkingNoteTaskRef[];
  createdAt: string;
  updatedAt: string;
};

/** `reminderAt` is a `datetime-local`-shaped string ("" = no reminder). */
export type ThinkingNoteDraft = {
  id?: string;
  title: string;
  content: string;
  reminderAt: string;
  tagNames: string[];
  taskIds: string[];
};

export function emptyThinkingNoteDraft(): ThinkingNoteDraft {
  return { title: "", content: "", reminderAt: "", tagNames: [], taskIds: [] };
}
