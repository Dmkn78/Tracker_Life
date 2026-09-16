package app.liferegime.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(QuickCapturePlugin.class);
        super.onCreate(state);
    }
    @Override public void onResume() {
        super.onResume();
        QuickNotification.refresh(this);
    }
}
