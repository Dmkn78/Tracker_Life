import { cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const main = resolve(root, "android/app/src/main");
await cp(resolve(root, "native/android"), main, { recursive: true });
const manifestPath = resolve(main, "AndroidManifest.xml");
let manifest = await readFile(manifestPath, "utf8");
if (!manifest.includes("android.permission.MODIFY_AUDIO_SETTINGS")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <application');
}
if (!manifest.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application');
}
if (!manifest.includes("android.permission.RECORD_AUDIO")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <application');
}
if (!manifest.includes("android.permission.POST_NOTIFICATIONS")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n    <application');
}
if (!manifest.includes("android.permission.MODIFY_AUDIO_SETTINGS")) {
  manifest = manifest.replace("<application", '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <application');
}
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
manifest = manifest.replace('android:icon="@mipmap/ic_launcher"', 'android:icon="@drawable/life_regime_mark"');
manifest = manifest.replace('android:roundIcon="@mipmap/ic_launcher_round"', 'android:roundIcon="@drawable/life_regime_mark"');
if (!manifest.includes("android:usesCleartextTraffic=")) manifest = manifest.replace("<application", '<application android:usesCleartextTraffic="true"');
// Bottom input strip opened by the widget and the notification, in its own task so it never brings the app forward.
const QUICK_CAPTURE_ACTIVITY = '<activity android:name=".QuickCaptureActivity" android:exported="false" android:excludeFromRecents="true" android:taskAffinity="" android:launchMode="singleTask" android:theme="@android:style/Theme.Material.Dialog.NoActionBar" android:windowSoftInputMode="adjustResize|stateAlwaysVisible" />';
const QUICK_CAPTURE_WIDGET = `<receiver android:name=".QuickCaptureWidget" android:exported="false" android:label="@string/widget_label">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/quick_capture_widget_info" />
        </receiver>`;
manifest = manifest.replace(/<activity android:name="\.QuickCaptureActivity"[^>]*\/>/, QUICK_CAPTURE_ACTIVITY);
if (!manifest.includes(".QuickCaptureActivity")) {
  manifest = manifest.replace("</application>", `${QUICK_CAPTURE_ACTIVITY}
        <receiver android:name=".QuickCaptureBootReceiver" android:enabled="true" android:exported="false">
            <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>
        </receiver>
    </application>`);
}
if (!manifest.includes(".QuickCaptureWidget")) {
  manifest = manifest.replace("</application>", `${QUICK_CAPTURE_WIDGET}
    </application>`);
}
await writeFile(manifestPath, manifest);
const settingsPath = resolve(root, "android/capacitor.settings.gradle");
const settings = await readFile(settingsPath, "utf8");
// Keep the generated project portable when local tooling is installed through a junction.
await writeFile(settingsPath, settings.replaceAll("../.runtime/android-tooling/node_modules/", "../node_modules/"));
console.log("Life Regime: native quick capture and notification integrated.");
