package app.liferegime.personal;

import android.Manifest;
import android.app.NotificationManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "QuickCapture", permissions = @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}))
public final class QuickCapturePlugin extends Plugin {
    @PluginMethod public void configure(PluginCall call) {
        String scope = call.getString("scope", "");
        if (scope.isEmpty()) { call.reject("Missing server scope"); return; }
        getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).edit().putString("scope", scope).apply();
        QuickNotification.refresh(getContext());
        call.resolve();
    }

    @PluginMethod public void updateSummary(PluginCall call) {
        String scope = call.getString("scope", "");
        android.content.SharedPreferences preferences = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0);
        if (!scope.equals(preferences.getString("scope", ""))) { call.reject("Server changed"); return; }
        int total = Math.max(0, call.getInt("total", 0));
        int completed = Math.max(0, Math.min(total, call.getInt("completed", 0)));
        StringBuilder titles = new StringBuilder();
        com.getcapacitor.JSArray requestedTitles = call.getArray("titles", new com.getcapacitor.JSArray());
        for (int index = 0; index < Math.min(requestedTitles.length(), 3); index++) {
            String title = requestedTitles.optString(index, "").replaceAll("\\s+", " ").trim();
            if (title.isEmpty()) continue;
            if (titles.length() > 0) titles.append("\n");
            titles.append("• ").append(title.substring(0, Math.min(title.length(), 120)));
        }
        preferences.edit().putString("summaryTitles", titles.toString()).remove("summaryError").putString("summaryScope", scope).putString("summaryDate", call.getString("date", ""))
            .putInt("summaryTotal", total).putInt("summaryCompleted", completed).putLong("summaryUpdatedAt", System.currentTimeMillis()).apply();
        QuickNotification.refresh(getContext());
        call.resolve();
    }

    @PluginMethod public void notificationState(PluginCall call) {
        android.content.SharedPreferences preferences = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0);
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        boolean granted = manager.areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= 26) {
            android.app.NotificationChannel channel = manager.getNotificationChannel(QuickNotification.CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) granted = false;
        }
        JSObject result = new JSObject();
        result.put("enabled", preferences.getBoolean("enabled", false));
        result.put("permissionGranted", granted);
        call.resolve(result);
    }

    @PluginMethod public void summaryError(PluginCall call) {
        android.content.SharedPreferences preferences = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0);
        if (!call.getString("scope", "").equals(preferences.getString("scope", ""))) { call.reject("Server changed"); return; }
        String message = call.getString("message", "Synchronisation indisponible");
        preferences.edit().putString("summaryError", message.substring(0, Math.min(message.length(), 250))).apply();
        QuickNotification.refresh(getContext());
        call.resolve();
    }

    @PluginMethod public void openNotificationSettings(PluginCall call) {
        android.content.Intent intent;
        if (Build.VERSION.SDK_INT >= 26) intent = new android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        else intent = new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod public void showTaskKeyboard(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            android.webkit.WebView webView = getBridge().getWebView();
            webView.postDelayed(() -> {
                if (!getActivity().isFinishing()) {
                    webView.requestFocus();
                    getContext().getSystemService(android.view.inputmethod.InputMethodManager.class)
                        .showSoftInput(webView, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
                }
            }, 150);
            call.resolve();
        });
    }

    @PluginMethod public void list(PluginCall call) {
        try (QuickCaptureStore store = new QuickCaptureStore(getContext())) {
            JSObject result = new JSObject();
            result.put("captures", store.list(call.getString("scope", "")));
            call.resolve(result);
        } catch (Exception exception) { call.reject("Unable to read captures", exception); }
    }

    @PluginMethod public void capture(PluginCall call) {
        try (QuickCaptureStore store = new QuickCaptureStore(getContext())) {
            String scope = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).getString("scope", "");
            store.capture(call.getString("title", ""), scope);
            call.resolve();
        } catch (Exception exception) { call.reject("Unable to preserve capture", exception); }
    }

    @PluginMethod public void acknowledge(PluginCall call) {
        try (QuickCaptureStore store = new QuickCaptureStore(getContext())) {
            store.acknowledge(call.getString("id", ""), call.getString("scope", ""));
            QuickNotification.refresh(getContext());
            call.resolve();
        } catch (Exception exception) { call.reject("Unable to acknowledge capture", exception); }
    }

    @PluginMethod public void enableNotification(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        } else notificationPermissionResult(call);
    }

    @PermissionCallback private void notificationPermissionResult(PluginCall call) {
        boolean enabled = Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED;
        getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).edit().putBoolean("enabled", enabled).apply();
        if (enabled) QuickNotification.refresh(getContext());
        JSObject result = new JSObject();
        result.put("enabled", enabled && getContext().getSystemService(NotificationManager.class).areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod public void disableNotification(PluginCall call) {
        getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).edit().putBoolean("enabled", false).apply();
        getContext().getSystemService(NotificationManager.class).cancel(QuickNotification.NOTIFICATION_ID);
        call.resolve();
    }
}
