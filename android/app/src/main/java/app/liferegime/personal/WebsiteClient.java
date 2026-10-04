package app.liferegime.personal;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

final class WebsiteClient extends BridgeWebViewClient {
    private final MainActivity activity;
    private final String origin;

    WebsiteClient(Bridge bridge, MainActivity activity, String origin) {
        super(bridge);
        this.activity = activity;
        this.origin = origin;
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String target = request.getUrl().toString();
        if (WebsiteOrigin.contains(origin, target)) return false;
        if (request.isForMainFrame() && request.hasGesture() && (target.startsWith("https://") || target.startsWith("http://"))) {
            try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(target))); }
            catch (android.content.ActivityNotFoundException ignored) { }
        } else if (request.isForMainFrame()) activity.showWebsiteError("Le site redirige vers une autre adresse. Configure son adresse finale dans « Serveur ».");
        return true;
    }

    @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
        if (!WebsiteOrigin.contains(origin, url)) { view.stopLoading(); return; }
        super.onPageStarted(view, url, favicon);
    }

    @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (request.isForMainFrame()) activity.showWebsiteError("Impossible de joindre le site. Vérifie la connexion et l’adresse du serveur, puis réessaie.");
    }

    @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
        super.onReceivedHttpError(view, request, response);
        if (request.isForMainFrame()) activity.showWebsiteError("Le serveur a répondu HTTP " + response.getStatusCode() + ". Tu peux réessayer ou changer son adresse.");
    }

    @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
        handler.cancel();
        activity.showWebsiteError("Le certificat HTTPS du site n’est pas valide pour cette adresse. Utilise le domaine HTTPS du site.");
    }
}
