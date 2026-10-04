package app.liferegime.personal;

import java.net.URI;
import java.util.Locale;

/** Only one explicitly configured website origin receives the native bridge. */
public final class WebsiteOrigin {
    private WebsiteOrigin() { }

    public static String normalize(String input, boolean allowHttp) {
        try {
            URI uri = new URI(input.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("https") && !(allowHttp && scheme.equals("http"))) throw new IllegalArgumentException();
            if (uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) throw new IllegalArgumentException();
            if (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/")) throw new IllegalArgumentException();
            int port = uri.getPort();
            if (port == 0 || port > 65535) throw new IllegalArgumentException();
            if (port == (scheme.equals("https") ? 443 : 80)) port = -1;
            return new URI(scheme, null, uri.getHost().toLowerCase(Locale.ROOT), port, null, null, null).toString();
        } catch (Exception exception) {
            throw new IllegalArgumentException("Indique l’adresse du site, https://domaine avec son port éventuel, sans chemin. HTTP nécessite la case d’autorisation.");
        }
    }

    public static boolean contains(String origin, String target) {
        try {
            URI uri = new URI(target);
            if (uri.getRawUserInfo() != null || uri.getHost() == null) return false;
            String targetOrigin = new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), null, null, null).toString();
            return origin.equals(normalize(targetOrigin, true));
        } catch (Exception exception) { return false; }
    }
}
