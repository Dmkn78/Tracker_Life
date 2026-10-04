import test from "node:test";
import assert from "node:assert/strict";
import { parseAppRelease, isNewerRelease, MAX_APK_BYTES, MAX_ANDROID_VERSION_CODE } from "./appUpdate.ts";

const sha256 = "a".repeat(64);
const release = { version: "1.0.4", versionCode: 5, sha256, size: 4500000, apkPath: `/api/mobile-update/apk/${sha256}` };

test("only a higher Android build is offered as an update", () => {
  const parsed = parseAppRelease({ release });
  assert.equal(isNewerRelease(parsed, 4), true);
  assert.equal(isNewerRelease(parsed, 5), false);
  assert.equal(isNewerRelease(parsed, 6), false);
  assert.equal(parseAppRelease({ release: null }), null);
});

test("rejects malformed metadata, excessive files and external download destinations", () => {
  for (const invalid of [null, {}, { release: {} }, { release: { ...release, versionCode: 0 } }, { release: { ...release, size: MAX_APK_BYTES + 1 } }, { release: { ...release, sha256: "bad" } }, { release: { ...release, apkPath: "https://other.example/app.apk" } }, { release: { ...release, apkPath: "/api/mobile-update/apk/" + "b".repeat(64) } }]) assert.throws(() => parseAppRelease(invalid));
});

test("rejects Android version codes that cannot cross the native integer boundary", () => {
  for (const versionCode of ["5", 1.5, NaN, Infinity, MAX_ANDROID_VERSION_CODE + 1]) {
    assert.throws(() => parseAppRelease({ release: { ...release, versionCode } }));
  }
  assert.equal(parseAppRelease({ release: { ...release, versionCode: MAX_ANDROID_VERSION_CODE } }).versionCode, MAX_ANDROID_VERSION_CODE);
});

test("does not offer installation when the installed Android version is unreadable", () => {
  for (const installedCode of [NaN, Infinity, 0, -1, 1.5]) assert.equal(isNewerRelease(release, installedCode), false);
});

test("returns only the validated release contract", () => {
  assert.deepEqual(parseAppRelease({ release: { ...release, githubToken: "must-not-cross-the-boundary" } }), release);
});
