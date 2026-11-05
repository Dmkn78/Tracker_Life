export type NoteTypeFilter = "all" | "note" | "journal" | "semaine" | "objectif" | "idée";

export type SearchResult = {
  path: string;
  title: string;
  noteType: string;
  dateKey: string | null;
  excerpt: string;
  heading: string;
  reasons: string[];
};

export type VaultStatus = { vaultPath: string; exists: boolean; noteCount: number; managedCount: number };

export type SyncReport = { created: number; updated: number; unchanged: number; conflicts: string[] };

export type NoteLink = { path: string; title: string };

export type NoteDocument = { path: string; frontmatter: Record<string, unknown>; body: string; links: NoteLink[] };

export const NOTE_TYPE_FILTERS: readonly NoteTypeFilter[] = ["all", "note", "journal", "semaine", "objectif", "idée"];

export function toSearchTypes(filter: NoteTypeFilter): string[] {
  const searchTypes = filter === "all" ? [] : [filter];
  return searchTypes;
}

/** Frontmatter values shown as small chips; nested objects are not displayed. */
export function listFrontmatterChips(frontmatter: Record<string, unknown>): string[] {
  const chips = Object.entries(frontmatter)
    .filter(([key]) => key !== "tracker_id")
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.filter((entry) => typeof entry !== "object").map((entry) => `${key}: ${String(entry)}`);
      if (value === null || typeof value === "object") return [];
      return [`${key}: ${String(value)}`];
    });
  return chips;
}
