package app.liferegime.personal;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.UUID;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class QuickCaptureStoreTest {
    @Test public void captureSurvivesReopeningAndRequiresItsOwnScopeToAcknowledge() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String scope = "test:" + UUID.randomUUID();
        String id;
        try (QuickCaptureStore store = new QuickCaptureStore(context)) {
            store.capture("  Préparer la semaine  ", scope);
            id = store.list(scope).getJSONObject(0).getString("id");
        }
        try (QuickCaptureStore reopened = new QuickCaptureStore(context)) {
            try {
                assertEquals("Préparer la semaine", reopened.list(scope).getJSONObject(0).getString("title"));
                assertEquals(0, reopened.list(scope + ":another-server").length());
                reopened.acknowledge(id, scope + ":another-server");
                assertEquals(1, reopened.list(scope).length());
                reopened.acknowledge(id, scope);
                assertEquals(0, reopened.list(scope).length());
            } finally {
                reopened.acknowledge(id, scope);
            }
        }
    }
}
