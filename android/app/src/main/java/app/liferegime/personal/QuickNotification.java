package app.liferegime.personal;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.os.Build;

public final class QuickNotification {
    static final String PREFERENCES = "quick-capture";
    static final String CHANNEL = "quick-task-capture";
    static final int NOTIFICATION_ID = 7101;

    private QuickNotification() { }

    public static void refresh(Context context) {
        if (!context.getSharedPreferences(PREFERENCES, 0).getBoolean("enabled", false)) return;
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Ajout rapide de tâches", NotificationManager.IMPORTANCE_LOW));
        Intent capture = new Intent(context, QuickCaptureActivity.class);
        PendingIntent action = PendingIntent.getActivity(context, NOTIFICATION_ID, capture, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(R.drawable.ic_quick_add)
            .setContentTitle("Life Regime")
            .setContentText("+ Ajouter une tâche")
            .setContentIntent(action)
            .addAction(new Notification.Action.Builder(Icon.createWithResource(context, R.drawable.ic_quick_add), "+", action).build())
            .setVisibility(Notification.VISIBILITY_SECRET)
            .setOngoing(true).setShowWhen(false);
        manager.notify(NOTIFICATION_ID, builder.build());
    }
}
