export type AppRelease = { version: string; versionCode: number; sha256: string; size: number; apkPath: string };
export const MAX_APK_BYTES = 100 * 1024 * 1024;
export const MAX_ANDROID_VERSION_CODE = 2_147_483_647;

export function parseAppRelease(payload: unknown): AppRelease | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Réponse de mise à jour invalide.");
  const release = (payload as Record<string, unknown>).release;
  if (release === null) return null;
  if (!release || typeof release !== "object" || Array.isArray(release)) throw new Error("Version publiée invalide.");
  const value = release as Record<string, unknown>;
  if (typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.version)
    || typeof value.versionCode !== "number" || !Number.isSafeInteger(value.versionCode) || value.versionCode < 1 || value.versionCode > MAX_ANDROID_VERSION_CODE
    || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)
    || typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > MAX_APK_BYTES
    || typeof value.apkPath !== "string" || value.apkPath !== `/api/mobile-update/apk/${value.sha256}`) throw new Error("Version publiée invalide.");
  return { version: value.version, versionCode: value.versionCode, sha256: value.sha256, size: value.size, apkPath: value.apkPath };
}

export function isNewerRelease(release: AppRelease, installedCode: number): boolean {
  return Number.isInteger(installedCode) && installedCode >= 1 && release.versionCode > installedCode;
}
