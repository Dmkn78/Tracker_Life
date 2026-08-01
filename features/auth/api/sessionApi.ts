import { expectJsonObject, requestJson } from "@/lib/http/apiClient";

type SessionActionResponse = { ok: true };

export function loginSession(accessKey: string): Promise<SessionActionResponse> {
  return requestJson("/api/auth/login", parseSessionActionResponse, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey })
  });
}

export async function logoutSession(): Promise<void> {
  await requestJson("/api/auth/logout", parseSessionActionResponse, {
    method: "POST"
  });
}

function parseSessionActionResponse(payload: unknown): SessionActionResponse {
  const response = expectJsonObject(payload, "session response");
  if (response.ok !== true) throw new Error("session response.ok must be true");
  return { ok: true };
}
