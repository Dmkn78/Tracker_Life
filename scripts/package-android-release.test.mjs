import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageAndroidRelease } from "./package-android-release.mjs";

async function createAndroidBuild(t, changes = {}) {
  const projectRoot = await mkdtemp(join(tmpdir(), "life-regime-release-"));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  const build = join(projectRoot, "android/app/build/outputs/apk/release");
  await mkdir(build, { recursive: true });
  const apk = Buffer.from("signed-apk-fixture");
  await writeFile(join(build, "app-release.apk"), apk);
  const artifact = { versionCode: 123456, versionName: "1.0.8", outputFile: "app-release.apk", ...changes };
  await writeFile(join(build, "output-metadata.json"), JSON.stringify({ applicationId: "app.liferegime.personal", elements: [artifact] }));
  return { projectRoot, build, apk };
}

test("packages the signed release APK with its digest and existing mobile API contract", async t => {
  const { projectRoot, apk } = await createAndroidBuild(t);
  const release = await packageAndroidRelease({ projectRoot });
  const sha256 = createHash("sha256").update(apk).digest("hex");
  assert.deepEqual(release, { version: "1.0.8", versionCode: 123456, sha256, size: apk.length, apkPath: `/api/mobile-update/apk/${sha256}` });
  const output = join(projectRoot, ".runtime/mobile-release");
  assert.deepEqual(await readFile(join(output, `${sha256}.apk`)), apk);
  assert.deepEqual(JSON.parse(await readFile(join(output, "release.json"), "utf8")), release);
});

test("refuses unsigned APKs and paths that escape the build directory", async t => {
  for (const outputFile of ["app-release-unsigned.apk", "../app-release.apk", "..\\app-release.apk"]) {
    const { projectRoot } = await createAndroidBuild(t, { outputFile });
    await assert.rejects(packageAndroidRelease({ projectRoot }), /Métadonnées APK invalides/);
  }
});

test("refuses invalid Android versions, empty artifacts and split APK metadata", async t => {
  for (const changes of [{ versionCode: 0 }, { versionCode: 2100000001 }, { versionName: "1.0.8-preview" }]) {
    const { projectRoot } = await createAndroidBuild(t, changes);
    await assert.rejects(packageAndroidRelease({ projectRoot }), /Métadonnées APK invalides/);
  }
  const { projectRoot, build } = await createAndroidBuild(t);
  await writeFile(join(build, "app-release.apk"), "");
  await assert.rejects(packageAndroidRelease({ projectRoot }), /Taille APK invalide/);
  await writeFile(join(build, "output-metadata.json"), JSON.stringify({ applicationId: "app.liferegime.personal", elements: [] }));
  await assert.rejects(packageAndroidRelease({ projectRoot }), /Métadonnées APK invalides/);
});
