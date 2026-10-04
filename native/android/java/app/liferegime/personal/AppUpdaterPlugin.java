package app.liferegime.personal;

import android.content.Intent;
import android.content.ClipData;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdater")
public final class AppUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 100L * 1024 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 120000;
    private static final long DOWNLOAD_TIMEOUT_MS = 300000;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);

    @PluginMethod public void install(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("Une mise à jour est déjà en cours."); return; }
        worker.execute(() -> {
            try {
                String server = call.getString("server", "");
                String digest = call.getString("sha256", "");
                int versionCode = call.getInt("versionCode", 0);
                String version = call.getString("version", "");
                long size = call.getInt("size", 0);
                validateSource(server, digest, size);
                if (versionCode < 1 || (!version.isEmpty() && !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+"))) throw new Exception("Informations de version Android invalides.");
                if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    getActivity().runOnUiThread(() -> {
                        try {
                            validateSource(server, digest, size);
                            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
                            call.resolve(new JSObject().put("permissionRequired", true));
                        } catch (Exception exception) { call.reject("Impossible d’ouvrir l’autorisation d’installation.", exception); }
                        finally { busy.set(false); }
                    });
                    return;
                }
                File apk = download(server, digest, size);
                verifyPackage(apk, versionCode, version);
                validateSource(server, digest, size);
                getActivity().runOnUiThread(() -> {
                    try {
                        validateSource(server, digest, size);
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        intent.setClipData(ClipData.newRawUri("Life Regime update", uri));
                        getActivity().startActivity(intent);
                        call.resolve(new JSObject().put("permissionRequired", false));
                    } catch (Exception exception) { call.reject("Impossible d’ouvrir l’installateur Android.", exception); }
                    finally { busy.set(false); }
                });
            } catch (Exception exception) { busy.set(false); call.reject(exception.getMessage(), exception); }
        });
    }

    private void validateSource(String server, String digest, long size) throws Exception {
        String scope = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).getString("scope", "");
        if (!server.equals(scope) || !server.equals(WebsiteOrigin.normalize(server, true))) throw new Exception("Le serveur a changé. Recherche à nouveau la mise à jour.");
        if (!digest.matches("[a-f0-9]{64}") || size < 1 || size > MAX_APK_BYTES) throw new Exception("Informations de mise à jour invalides.");
        if (Thread.currentThread().isInterrupted()) throw new Exception("Mise à jour interrompue. Réessaie.");
    }

    private File download(String server, String digest, long size) throws Exception {
        File directory = new File(getContext().getCacheDir(), "updates");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new Exception("Impossible de créer le dossier de mise à jour.");
        File apk = new File(directory, digest + ".apk");
        if (apk.isFile() && apk.length() == size && digest.equals(hashFile(apk))) return apk;
        File temporary = new File(directory, "download.tmp");
        HttpURLConnection connection = (HttpURLConnection) new URL(server + "/api/mobile-update/apk/" + digest).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept-Encoding", "identity");
        connection.setRequestProperty("Cache-Control", "no-cache");
        long deadline = SystemClock.elapsedRealtime() + DOWNLOAD_TIMEOUT_MS;
        try {
            if (connection.getResponseCode() != 200) throw new Exception("Téléchargement indisponible. Vérifie que l’APK est publié sur le serveur.");
            long declaredSize = connection.getContentLengthLong();
            if (declaredSize >= 0 && declaredSize != size) throw new Exception("La taille publiée de l’APK ne correspond pas au téléchargement. Recherche à nouveau la mise à jour.");
            long received = 0;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(temporary)) {
                byte[] buffer = new byte[32768];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    received += count;
                    if (received > size || received > MAX_APK_BYTES) throw new Exception("La taille de l’APK est invalide.");
                    if (Thread.currentThread().isInterrupted() || SystemClock.elapsedRealtime() > deadline) throw new Exception("Téléchargement interrompu ou trop lent. Réessaie.");
                    output.write(buffer, 0, count);
                }
            }
            if (received != size || !digest.equals(hashFile(temporary))) throw new Exception("L’APK reçu est incomplet ou altéré. Réessaie.");
            if (apk.exists() && !apk.delete()) throw new Exception("Impossible de remplacer le téléchargement précédent.");
            if (!temporary.renameTo(apk)) throw new Exception("Impossible de conserver l’APK.");
            return apk;
        } finally { connection.disconnect(); if (temporary.exists()) temporary.delete(); }
    }

    private void verifyPackage(File apk, int expectedCode, String expectedVersion) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo current = manager.getPackageInfo(getContext().getPackageName(), flags);
        PackageInfo update = manager.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (update == null || !current.packageName.equals(update.packageName)) throw new Exception("Cet APK ne correspond pas à Life Regime.");
        long currentCode = Build.VERSION.SDK_INT >= 28 ? current.getLongVersionCode() : current.versionCode;
        long updateCode = Build.VERSION.SDK_INT >= 28 ? update.getLongVersionCode() : update.versionCode;
        if (updateCode != expectedCode || updateCode <= currentCode) throw new Exception("Cet APK n’est pas une version plus récente.");
        if (!expectedVersion.isEmpty() && !expectedVersion.equals(update.versionName)) throw new Exception("La version de cet APK ne correspond pas à la publication. Recherche à nouveau la mise à jour.");
        if (!signers(current).equals(signers(update))) throw new Exception("La signature de cet APK diffère de l’application installée.");
    }

    private Set<String> signers(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        if (signatures == null || signatures.length == 0) throw new Exception("Signature Android absente.");
        Set<String> result = new HashSet<>();
        for (Signature signature : signatures) result.add(signature.toCharsString());
        return result;
    }

    private String hashFile(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value & 0xff));
        return result.toString();
    }

    @Override protected void handleOnDestroy() { worker.shutdownNow(); super.handleOnDestroy(); }
}
