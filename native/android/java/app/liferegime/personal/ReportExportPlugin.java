package app.liferegime.personal;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "ReportExport")
public final class ReportExportPlugin extends Plugin {
    @PluginMethod public void share(PluginCall call) {
        String weekId = call.getString("weekId", "");
        String json = call.getString("json", "");
        if (!weekId.matches("\\d{4}-W\\d{2}") || json.isEmpty()) { call.reject("Invalid report"); return; }
        try {
            File directory = new File(getContext().getCacheDir(), "reports");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("Unable to create export directory");
            File report = new File(directory, "Life-Regime-" + weekId + ".json");
            try (FileOutputStream stream = new FileOutputStream(report)) {
                stream.write(json.getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", report);
            Intent intent = new Intent(Intent.ACTION_SEND).setType("application/json")
                .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("Weekly report", uri));
            getActivity().runOnUiThread(() -> {
                try { getActivity().startActivity(Intent.createChooser(intent, "Exporter le rapport")); call.resolve(); }
                catch (Exception exception) { call.reject("Impossible d’ouvrir l’export", exception); }
            });
        } catch (Exception exception) { call.reject("Impossible de préparer l’export", exception); }
    }
}
