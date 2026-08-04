import { expectJsonObject, expectString, requestJson } from "@/lib/http/apiClient";
import type { Tag } from "../domain/tagCompany";

export function listTags(signal?: AbortSignal): Promise<Tag[]> {
  return requestJson("/api/tags", parseTagsResponse, { signal });
}

export function deleteTag(id: string): Promise<void> {
  return requestJson(`/api/tags?id=${encodeURIComponent(id)}`, () => undefined, {
    method: "DELETE"
  });
}

function parseTagsResponse(payload: unknown): Tag[] {
  const response = expectJsonObject(payload, "tags response");
  if (!Array.isArray(response.tags)) {
    throw new Error("tags response.tags must be an array");
  }
  return response.tags.map((tag, index) => parseTag(tag, `tags response.tags[${index}]`));
}

function parseTag(payload: unknown, context: string): Tag {
  const tag = expectJsonObject(payload, context);
  return {
    id: expectString(tag.id, `${context}.id`),
    name: expectString(tag.name, `${context}.name`),
    color: expectString(tag.color, `${context}.color`)
  };
}
