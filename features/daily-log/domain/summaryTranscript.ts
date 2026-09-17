export function appendSummaryTranscript(summary: string, transcript: string): string {
  const text = transcript.trim();
  if (!text) return summary;
  const updatedSummary = summary.trim() ? `${summary.trimEnd()}\n${text}` : text;
  return updatedSummary;
}
