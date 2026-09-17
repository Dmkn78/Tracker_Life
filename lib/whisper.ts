import { expectJsonObject, expectNumber, expectString, requestJson } from "@/lib/http/apiClient";

export type TranscriptionStatus = "idle" | "uploading" | "transcribing" | "done" | "error";
const JOB_API_PATH = "/api/transcription-jobs";
const UPLOAD_TIMEOUT_MS = 600_000;
const JOB_TIMEOUT_MS = 3_660_000;
const POLL_INTERVAL_MS = 2_000;

function waitForPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const aborted = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", aborted);
      resolve();
    }, POLL_INTERVAL_MS);
    signal?.addEventListener("abort", aborted, { once: true });
  });
}

export async function transcribeAudio(
  file: File,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const jobId = await requestJson(JOB_API_PATH, (payload) => {
    const job = expectJsonObject(payload, "transcription job");
    return expectString(job.jobId, "jobId");
  }, { method: "POST", body: formData, signal, timeoutMs: UPLOAD_TIMEOUT_MS });
  const jobPath = `${JOB_API_PATH}/${encodeURIComponent(jobId)}`;
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  try {
    onProgress?.(0);
    while (Date.now() < deadline) {
      const job = await requestJson(jobPath, (payload) => {
        const value = expectJsonObject(payload, "transcription job");
        return {
          state: expectString(value.state, "state"),
          progress: expectNumber(value.progress, "progress"),
          text: expectString(value.text, "text"),
          error: expectString(value.error, "error"),
        };
      }, { signal });
      onProgress?.(job.progress);
      if (job.state === "done") return job.text;
      if (job.state === "error") throw new Error(job.error || "Transcription failed.");
      if (job.state === "cancelled") throw new DOMException("Aborted", "AbortError");
      if (job.state !== "transcribing") throw new Error("Invalid transcription state.");
      await waitForPoll(signal);
    }
    throw new Error("Transcription timed out. Please retry with a shorter file.");
  } finally {
    // Independent signal: navigation/cancellation must also stop server inference.
    void requestJson(jobPath, () => undefined, { method: "DELETE", keepalive: true }).catch(() => undefined);
  }
}
