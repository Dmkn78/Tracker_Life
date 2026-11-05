import { createTodoTasks } from "@/features/todo/api/todoApi";
import { captureNote } from "@/features/knowledge/api/knowledgeApi";
import type { CaptureOutcome, CaptureRequest } from "../domain/quickCapture";

/** Website behaviour: save directly on the server. */
export async function saveCaptureOnline(capture: CaptureRequest): Promise<CaptureOutcome> {
  if (capture.kind === "task") await createTodoTasks({ items: [{ title: capture.text, date: capture.date }] });
  else await captureNote(capture.text);
  return "saved";
}
