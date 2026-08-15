export type EmotionEntry = {
  name: string;
  intensity: number;
};

export type EmotionalReviewDraft = {
  weekId: string;
  emotions: EmotionEntry[];
  factors: string[];
  stressLevel: number;
  triggers: string[];
  mentalSignals: string[];
  physicalSignals: string[];
  whatHelped: string[];
  nextWeekAction: string;
  notes: string;
};

export type EmotionalReview = EmotionalReviewDraft & {
  id: string;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
};

export function emptyEmotionalReview(weekId: string): EmotionalReviewDraft {
  return {
    weekId,
    emotions: [],
    factors: [],
    stressLevel: 0,
    triggers: [],
    mentalSignals: [],
    physicalSignals: [],
    whatHelped: [],
    nextWeekAction: "",
    notes: ""
  };
}

export function linesToItems(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}
