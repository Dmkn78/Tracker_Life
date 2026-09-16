package app.liferegime.personal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class QuickCaptureBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) QuickNotification.refresh(context);
    }
}
