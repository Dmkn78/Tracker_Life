import { expectJsonObject, expectString, requestJson } from "@/lib/http/apiClient";

export type TranscriptionStatus = "idle" | "uploading" | "transcribing" | "done" | "error";

export async function transcribeAudio(file: File, signal?: AbortSignal): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await requestJson(
    "/api/transcribe",
    (payload) => {
      const transcription = expectJsonObject(payload, "transcription response");
      return { text: expectString(transcription.text, "transcription.text") };
    },
    {
      method: "POST",
      body: formData,
      signal,
      timeoutMs: 190_000
    }
  );
  return response.text;
}
