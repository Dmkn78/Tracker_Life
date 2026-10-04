export function readWebsiteVersion(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("version" in payload)) return null;
  return typeof payload.version === "string" && /^[a-zA-Z0-9._-]{1,128}$/.test(payload.version) ? payload.version : null;
}

export function loginDestination(input: string | null): string {
  // Notification quick-add is the only deep link currently carried through login.
  return input === "/todo?create=today" ? input : "/";
}
