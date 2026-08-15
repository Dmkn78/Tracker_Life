import { expectJsonObject, expectNumber, expectString, expectStringArray, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import type { EmotionalReview, EmotionalReviewDraft, EmotionEntry } from "../domain/emotionalReview";

export type EmotionalReviewResponse = { review: EmotionalReview | null; weekId: string };

export function loadEmotionalReview(weekId: string, signal?: AbortSignal): Promise<EmotionalReviewResponse> {
  return requestJson(`/api/emotional-reviews?week=${encodeURIComponent(weekId)}`, parseResponse, { signal });
}

export function saveEmotionalReview(draft: EmotionalReviewDraft): Promise<EmotionalReview> {
  return requestJson("/api/emotional-reviews", parseSavedResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft)
  });
}

function parseSavedResponse(payload: unknown): EmotionalReview {
  const response = parseResponse(payload);
  if (!response.review) throw new Error("emotional review response.review must be an object");
  return response.review;
}

function parseResponse(payload: unknown): EmotionalReviewResponse {
  const response = expectJsonObject(payload, "emotional review response");
  return {
    weekId: expectString(response.weekId, "emotional review response.weekId"),
    review: response.review === null ? null : parseReview(response.review)
  };
}

function parseReview(payload: unknown): EmotionalReview {
  const review = expectJsonObject(payload, "emotional review");
  return {
    id: expectString(review.id, "emotional review.id"),
    weekId: expectString(review.weekId, "emotional review.weekId"),
    weekStart: expectString(review.weekStart, "emotional review.weekStart"),
    emotions: parseJsonArray(review.emotions, "emotional review.emotions", parseEmotion),
    factors: expectStringArray(review.factors, "emotional review.factors"),
    stressLevel: expectNumber(review.stressLevel, "emotional review.stressLevel"),
    triggers: expectStringArray(review.triggers, "emotional review.triggers"),
    mentalSignals: expectStringArray(review.mentalSignals, "emotional review.mentalSignals"),
    physicalSignals: expectStringArray(review.physicalSignals, "emotional review.physicalSignals"),
    whatHelped: expectStringArray(review.whatHelped, "emotional review.whatHelped"),
    nextWeekAction: expectString(review.nextWeekAction, "emotional review.nextWeekAction"),
    notes: expectString(review.notes, "emotional review.notes"),
    createdAt: expectString(review.createdAt, "emotional review.createdAt"),
    updatedAt: expectString(review.updatedAt, "emotional review.updatedAt")
  };
}

function parseEmotion(payload: unknown, context: string): EmotionEntry {
  const emotion = expectJsonObject(payload, context);
  return { name: expectString(emotion.name, `${context}.name`), intensity: expectNumber(emotion.intensity, `${context}.intensity`) };
}
