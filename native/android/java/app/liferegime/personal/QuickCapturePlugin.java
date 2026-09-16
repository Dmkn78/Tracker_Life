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
        call.resolve();
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
