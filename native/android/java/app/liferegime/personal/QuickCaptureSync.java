package app.liferegime.personal;

import android.content.Context;
import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Best-effort immediate delivery of widget captures, using the session cookie of the app.
 * Failure is silent: the capture stays in the outbox and the app retries it with the same id,
 * which the server deduplicates.
 */
final class QuickCaptureSync {
    private static final int TIMEOUT_MS = 10_000;
    private static final int MAX_RESPONSE_BYTES = 65_536;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    private QuickCaptureSync() { }

    static void sendPendingInBackground(Context context) {
        Context applicationContext = context.getApplicationContext();
        EXECUTOR.execute(() -> sendPending(applicationContext));
    }

    private static void sendPending(Context context) {
        String scope = context.getSharedPreferences(QuickNotification.PREFERENCES, 0).getString("scope", "");
        if (scope.isEmpty()) return;
        String cookie = CookieManager.getInstance().getCookie(scope);
        if (cookie == null || cookie.isEmpty()) return;
        try (QuickCaptureStore store = new QuickCaptureStore(context)) {
            List<QuickCaptureStore.PendingCapture> captures = store.pending(scope);
            for (QuickCaptureStore.PendingCapture capture : captures) {
                if (!send(scope, cookie, capture)) break;
                store.acknowledge(capture.id, scope);
            }
        } catch (Exception ignored) {
            // Keep the outbox untouched; the app synchronises on its next start.
        }
        QuickNotification.refresh(context);
    }

    private static boolean send(String scope, String cookie, QuickCaptureStore.PendingCapture capture) throws Exception {
        boolean isNote = QuickCaptureStore.NOTE.equals(capture.kind);
        JSONObject body = new JSONObject().put("requestId", capture.id);
        if (isNote) body.put("text", capture.title);
        else body.put("title", capture.title).put("date", capture.date == null ? JSONObject.NULL : capture.date);
        URL url = new URL(scope + (isNote ? "/api/knowledge/notes" : "/api/tasks/capture"));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cookie", cookie);
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return false;
            JSONObject receipt = new JSONObject(readBounded(connection.getInputStream()));
            return capture.id.equals(receipt.optString("captureId"));
        } finally {
            connection.disconnect();
        }
    }

    private static String readBounded(InputStream input) throws Exception {
        try (InputStream stream = input; ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[4096];
            int read;
            while ((read = stream.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
                if (buffer.size() > MAX_RESPONSE_BYTES) throw new IllegalStateException("Response too large");
            }
            return buffer.toString("UTF-8");
        }
    }
}
