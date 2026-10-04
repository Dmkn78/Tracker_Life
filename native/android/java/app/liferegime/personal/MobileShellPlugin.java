package app.liferegime.personal;

import android.content.SharedPreferences;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MobileShell")
public final class MobileShellPlugin extends Plugin {
    @PluginMethod public void status(PluginCall call) {
        SharedPreferences preferences = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0);
        JSObject status = new JSObject();
        status.put("server", preferences.getString("scope", ""));
        status.put("hosted", ((MainActivity) getActivity()).isHostedInterface());
        status.put("fallbackReason", preferences.getString(MainActivity.FALLBACK_REASON, ""));
        status.put("theme", preferences.getString("pending-mobile-theme", ""));
        status.put("locale", preferences.getString("pending-mobile-locale", ""));
        preferences.edit().remove("pending-mobile-theme").remove("pending-mobile-locale").apply();
        call.resolve(status);
    }

    @PluginMethod public void ready(PluginCall call) {
        getActivity().runOnUiThread(() -> ((MainActivity) getActivity()).interfaceReady());
        call.resolve();
    }

    @PluginMethod public void openPublished(PluginCall call) {
        String origin;
        try { origin = WebsiteOrigin.normalize(call.getString("server", ""), true); }
        catch (IllegalArgumentException exception) { call.reject(exception.getMessage()); return; }
        SharedPreferences preferences = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0);
        if (!origin.equals(preferences.getString("scope", ""))) { call.reject("Le serveur a changé. Reconnecte-le avant la mise à jour."); return; }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) { call.reject("Mets à jour Android System WebView."); return; }
        preserveAppearance(call);
        preferences.edit().putString(MainActivity.HOSTED_ORIGIN, origin).remove(MainActivity.FALLBACK_REASON).apply();
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().recreate());
    }

    @PluginMethod public void useBundled(PluginCall call) {
        preserveAppearance(call);
        getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).edit()
            .remove(MainActivity.HOSTED_ORIGIN).remove(MainActivity.FALLBACK_REASON).apply();
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().recreate());
    }
    private void preserveAppearance(PluginCall call) {
        String theme = call.getString("theme", "");
        String locale = call.getString("locale", "");
        SharedPreferences.Editor editor = getContext().getSharedPreferences(QuickNotification.PREFERENCES, 0).edit();
        if (java.util.Arrays.asList("cream", "light", "dark", "warm", "sunlight", "low-light", "adaptive").contains(theme)) editor.putString("pending-mobile-theme", theme);
        if (java.util.Arrays.asList("fr", "en", "system").contains(locale)) editor.putString("pending-mobile-locale", locale);
        editor.apply();
    }
}
