package app.liferegime.personal;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

public class MainActivity extends BridgeActivity {
    static final String HOSTED_ORIGIN = "mobile-hosted-origin";
    static final String FALLBACK_REASON = "mobile-fallback-reason";
    static final String MOBILE_ENTRY = "/mobile-app/index.html";
    private boolean hosted;
    private boolean recovering;
    private final Handler startupHandler = new Handler(Looper.getMainLooper());
    private final Runnable startupTimeout = () -> showWebsiteError("L’interface publiée ne répond pas. L’interface intégrée a été rétablie ; tu peux réessayer depuis les paramètres.");

    @Override public void onCreate(Bundle state) {
        android.content.SharedPreferences preferences = getSharedPreferences(QuickNotification.PREFERENCES, MODE_PRIVATE);
        String origin = preferences.getString(HOSTED_ORIGIN, "");
        String server = preferences.getString("scope", "");
        hosted = !origin.isEmpty() && origin.equals(server) && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
        if (hosted) {
            try {
                origin = WebsiteOrigin.normalize(origin, true);
                config = new CapConfig.Builder(this).setServerUrl(origin).setStartPath(MOBILE_ENTRY)
                    .setAndroidScheme("https").setBackgroundColor("#efe8da").setWebContentsDebuggingEnabled(false).create();
            } catch (IllegalArgumentException exception) { hosted = false; }
        }
        registerPlugin(QuickCapturePlugin.class);
        registerPlugin(ReportExportPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(MobileShellPlugin.class);
        super.onCreate(state);
        if (bridge == null) return;
        CookieManager.getInstance().setAcceptCookie(true);
        if (hosted) {
            bridge.getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
            bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            bridge.setWebViewClient(new WebsiteClient(bridge, this, origin));
            startupHandler.postDelayed(startupTimeout, 25_000);
        }
    }

    public boolean isHostedInterface() { return hosted; }
    public void interfaceReady() { startupHandler.removeCallbacks(startupTimeout); }

    public void showWebsiteError(String message) {
        if (!hosted || recovering || isFinishing()) return;
        recovering = true;
        getSharedPreferences(QuickNotification.PREFERENCES, MODE_PRIVATE).edit()
            .remove(HOSTED_ORIGIN).putString(FALLBACK_REASON, message).apply();
        interfaceReady();
        recreate();
    }

    @Override public void onResume() { super.onResume(); QuickNotification.refresh(this); }
    @Override public void onPause() { super.onPause(); CookieManager.getInstance().flush(); }
    @Override public void onDestroy() { interfaceReady(); super.onDestroy(); }
}
