import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
if (!existsSync(join(sdk, "platforms", "android-36"))) {
  console.error("Android SDK 36 absent. Installe Android Studio et Android SDK Platform 36, puis définis ANDROID_HOME. Voir docs/android.md.");
  process.exit(1);
}
const result = spawnSync(process.platform === "win32" ? "gradlew.bat" : "sh", [...(process.platform === "win32" ? [] : ["./gradlew"]), "--no-daemon", ":app:assembleDebug"], {
  cwd: join(root, "android"), stdio: "inherit", shell: process.platform === "win32",
  env: { ...process.env, ANDROID_HOME: sdk }
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("APK: " + join(root, "android/app/build/outputs/apk/debug/app-debug.apk"));
