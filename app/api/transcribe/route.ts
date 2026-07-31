import { Buffer } from "node:buffer";

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || "http://127.0.0.1:8001/transcribe";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Missing audio file" }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.set(
      "file",
      new Blob([Buffer.from(await file.arrayBuffer())], { type: file.type || "application/octet-stream" }),
      file.name || "audio"
    );

    let upstream: Response;
    try {
      upstream = await fetch(WHISPER_SERVICE_URL, {
        method: "POST",
        body: upstreamForm,
        signal: AbortSignal.timeout(180_000)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Whisper service unavailable";
      return Response.json(
        {
          error:
            message.includes("fetch failed") || message.includes("ECONNREFUSED")
              ? "Whisper service is not running. Start it with scripts/start-whisper-service.cmd or scripts/start-whisper-service.ps1."
              : `Whisper service unavailable: ${message}`
        },
        { status: 503 }
      );
    }

    if (!upstream.ok) {
      const message = await readUpstreamError(upstream);
      return Response.json({ error: message || "Transcription failed" }, { status: 502 });
    }

    const data = (await upstream.json()) as { text?: string };
    return Response.json({ text: data.text ?? "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function readUpstreamError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return response.text();
  }

  const body = (await response.json().catch(() => null)) as { detail?: unknown; error?: unknown } | null;
  if (typeof body?.detail === "string") return body.detail;
  if (typeof body?.error === "string") return body.error;
  return `Whisper service failed (${response.status})`;
}
