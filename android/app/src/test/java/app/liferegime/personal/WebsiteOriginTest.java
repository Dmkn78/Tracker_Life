package app.liferegime.personal;

import org.junit.Test;
import static org.junit.Assert.*;

public class WebsiteOriginTest {
    @Test public void acceptsOnlyAnOrigin() {
        assertEquals("https://example.com", WebsiteOrigin.normalize(" https://EXAMPLE.com:443/ ", false));
        assertEquals("https://example.com:8443", WebsiteOrigin.normalize("https://example.com:8443", false));
        assertEquals("http://192.168.1.2:3000", WebsiteOrigin.normalize("http://192.168.1.2:3000", true));
        assertEquals("https://[::1]", WebsiteOrigin.normalize("https://[::1]", false));
    }
    @Test public void rejectsUntrustedAddressesAndImplicitHttp() {
        for (String address : new String[] {"javascript:alert(1)", "file:///etc/hosts", "https://user:pass@example.com", "https://example.com/path", "https://example.com?key=secret", "https://example.com#hash", "http://example.com", "https://example.com:99999", "https://example.com:0", "https://example.com\\@evil.com"}) {
            assertThrows(address, IllegalArgumentException.class, () -> WebsiteOrigin.normalize(address, false));
        }
    }
    @Test public void bridgeTrustIncludesSchemeHostAndPort() {
        assertTrue(WebsiteOrigin.contains("https://example.com", "https://example.com:443/login?returnTo=%2Ftodo"));
        for (String url : new String[] {"https://example.com.evil.test", "https://evil.example.com", "http://example.com", "https://example.com:8443", "https://user@example.com", "file:///data/secret", "//example.com", "about:blank"}) {
            assertFalse(url, WebsiteOrigin.contains("https://example.com", url));
        }
    }
}
