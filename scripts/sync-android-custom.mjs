import { cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const main = resolve(root, "android/app/src/main");
await cp(resolve(root, "native/android"), main, { recursive: true });
const manifestPath = resolve(main, "AndroidManifest.xml");
let manifest = await readFile(manifestPath, "utf8");
if (!manifest.includes("android.permission.POST_NOTIFICATIONS")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n    <application');
}
if (!manifest.includes("android.permission.RECORD_AUDIO")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <application');
}
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
manifest = manifest.replace('android:icon="@mipmap/ic_launcher"', 'android:icon="@drawable/life_regime_mark"');
manifest = manifest.replace('android:roundIcon="@mipmap/ic_launcher_round"', 'android:roundIcon="@drawable/life_regime_mark"');
if (!manifest.includes("android:usesCleartextTraffic=")) manifest = manifest.replace("<application", '<application android:usesCleartextTraffic="true"');
if (!manifest.includes(".QuickCaptureActivity")) {
  manifest = manifest.replace("</application>", `<activity android:name=".QuickCaptureActivity" android:exported="false" android:excludeFromRecents="true" android:theme="@android:style/Theme.Material.Light.Dialog.Alert" android:windowSoftInputMode="adjustResize|stateAlwaysVisible" />
        <receiver android:name=".QuickCaptureBootReceiver" android:enabled="true" android:exported="false">
            <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>
        </receiver>
    </application>`);
}
await writeFile(manifestPath, manifest);
const settingsPath = resolve(root, "android/capacitor.settings.gradle");
const settings = await readFile(settingsPath, "utf8");
// Keep the generated project portable when local tooling is installed through a junction.
await writeFile(settingsPath, settings.replaceAll("../.runtime/android-tooling/node_modules/", "../node_modules/"));
console.log("Life Regime: native quick capture and notification integrated.");
