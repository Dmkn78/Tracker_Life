export type MobileInterfaceRelease = { schema: 1; version: string; builtAt: string; minNativeBuild: number; entry: "/mobile-app/index.html" };

export function parseMobileInterfaceRelease(payload: unknown): MobileInterfaceRelease {
  if (!payload || typeof payload !== "object") throw new Error("Publication mobile invalide.");
  const release = payload as Record<string, unknown>;
  if (release.schema !== 1 || release.entry !== "/mobile-app/index.html" || typeof release.version !== "string"
    || !/^[a-zA-Z0-9._-]{1,128}$/.test(release.version) || typeof release.builtAt !== "string" || !Number.isFinite(Date.parse(release.builtAt))
    || typeof release.minNativeBuild !== "number" || !Number.isSafeInteger(release.minNativeBuild) || release.minNativeBuild < 8) {
    throw new Error("Publication mobile invalide.");
  }
  return release as MobileInterfaceRelease;
}
