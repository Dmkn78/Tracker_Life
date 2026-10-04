import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APPLICATION_ID = "app.liferegime.personal";
const MAX_APK_BYTES = 100 * 1024 * 1024;
const root = resolve(import.meta.dirname, "..");

export async function packageAndroidRelease({ projectRoot = root, outputDirectory, buildVariant = "release" }) {
  if (buildVariant !== "debug" && buildVariant !== "release") throw new Error("Variante Android invalide.");
  const output = resolve(projectRoot, outputDirectory ?? ".runtime/mobile-release");
  const build = join(projectRoot, "android/app/build/outputs/apk", buildVariant);
  const metadata = JSON.parse(await readFile(join(build, "output-metadata.json"), "utf8"));
  const artifact = Array.isArray(metadata.elements) && metadata.elements.length === 1 ? metadata.elements[0] : null;
  if (metadata.applicationId !== APPLICATION_ID || !artifact
    || !Number.isSafeInteger(artifact.versionCode) || artifact.versionCode < 1 || artifact.versionCode > 2100000000
    || typeof artifact.versionName !== "string" || !/^\d+\.\d+\.\d+$/.test(artifact.versionName)
    || artifact.outputFile !== `app-${buildVariant}.apk`) throw new Error("Métadonnées APK invalides ou APK non signé.");

  const apkPath = join(build, artifact.outputFile);
  const apkStats = await stat(apkPath);
  if (!apkStats.isFile() || apkStats.size > MAX_APK_BYTES || apkStats.size === 0) throw new Error("Taille APK invalide.");
  const apk = await readFile(apkPath);
  const sha256 = createHash("sha256").update(apk).digest("hex");
  const release = {
    version: artifact.versionName,
    versionCode: artifact.versionCode,
    sha256,
    size: apk.length,
    apkPath: `/api/mobile-update/apk/${sha256}`,
  };
  await mkdir(output, { recursive: true });
  await copyFile(apkPath, join(output, `${sha256}.apk`));
  await writeFile(join(output, "release.json.tmp"), JSON.stringify(release, null, 2) + "\n");
  await rename(join(output, "release.json.tmp"), join(output, "release.json"));
  return release;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2] ?? ".runtime/mobile-release";
  const buildVariant = process.argv[3] ?? "release";
  const release = await packageAndroidRelease({ outputDirectory, buildVariant });
  console.log(`Version ${release.version} (Android ${release.versionCode}) prête à publier : ${resolve(root, outputDirectory)}`);
  console.log("Publier l’APK et release.json ensemble dans une GitHub Release. Conserver la même clé de signature entre versions.");
}
