export type TranscriptionStatus = "idle" | "uploading" | "transcribing" | "done" | "error";

export async function transcribeAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);

  let response: Response;
  try {
    response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `Transcription request failed: ${error.message}`
        : "Transcription request failed. Check that the Next.js dev server is running."
    );
  }

  if (!response.ok) {
    const message = await readTranscriptionError(response);
    throw new Error(message || "Transcription failed");
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}

async function readTranscriptionError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text();
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const detail = "detail" in body ? body.detail : undefined;
    const error = "error" in body ? body.error : undefined;
    if (typeof detail === "string") return detail;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "detail" in error && typeof error.detail === "string") return error.detail;
  }
  return `Transcription failed (${response.status})`;
}
