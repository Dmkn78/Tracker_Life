package app.liferegime.personal;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class QuickNotification {
    static final String PREFERENCES = "quick-capture";
    static final String CHANNEL = "quick-task-capture";
    static final int NOTIFICATION_ID = 7101;

    private QuickNotification() { }

    public static void refresh(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, 0);
        if (!preferences.getBoolean("enabled", false)) return;
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Ajout rapide de tâches", NotificationManager.IMPORTANCE_LOW));
        // The bottom input strip opens over the current screen, without launching the app.
        PendingIntent add = PendingIntent.getActivity(context, NOTIFICATION_ID, QuickCaptureActivity.intentFor(context, QuickCaptureStore.TASK),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent open = taskIntent(context, NOTIFICATION_ID + 1, "liferegime://todo");
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
        boolean known = today.equals(preferences.getString("summaryDate", "")) && preferences.getString("scope", "").equals(preferences.getString("summaryScope", ""));
        int completed = known ? preferences.getInt("summaryCompleted", 0) : 0;
        int total = known ? preferences.getInt("summaryTotal", 0) : 0;
        int pending;
        try (QuickCaptureStore store = new QuickCaptureStore(context)) { pending = store.pendingCount(preferences.getString("scope", "")); }
        String details = known ? "Tâches prévues · " + today + " · actualisé à " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(preferences.getLong("summaryUpdatedAt", 0))) : "Ouvrir Life Regime pour actualiser les tâches du jour";
        String syncError = preferences.getString("summaryError", "");
        if (!syncError.isEmpty()) details += "\n" + syncError;
        if (pending > 0) details += "\n" + pending + " ajout(s) en attente de synchronisation";
        RemoteViews compact = layout(context, R.layout.notification_quick_tasks, completed, total, known, add, open);
        RemoteViews expanded = layout(context, R.layout.notification_quick_tasks_expanded, completed, total, known, add, open);
        expanded.setTextViewText(R.id.notification_details, details);
        String titles = known ? preferences.getString("summaryTitles", "") : "";
        expanded.setTextViewText(R.id.notification_tasks, titles);
        expanded.setViewVisibility(R.id.notification_tasks, titles.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        expanded.setOnClickPendingIntent(R.id.notification_tasks, open);
        Notification notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_quick_add).setContentTitle("Life Regime · " + today)
            .setContentText(known ? completed + " / " + total + " tâches terminées" : "Ajouter une tâche")
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(compact).setCustomBigContentView(expanded)
            .setContentIntent(open).setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true).setShowWhen(false).build();
        manager.notify(NOTIFICATION_ID, notification);
    }

    private static PendingIntent taskIntent(Context context, int requestCode, String url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static RemoteViews layout(Context context, int resource, int completed, int total, boolean known, PendingIntent add, PendingIntent open) {
        RemoteViews views = new RemoteViews(context.getPackageName(), resource);
        views.setTextViewText(R.id.notification_count, known ? completed + " / " + total : "— / —");
        views.setProgressBar(R.id.notification_progress, Math.max(total, 1), completed, false);
        views.setOnClickPendingIntent(R.id.notification_add, add);
        views.setOnClickPendingIntent(R.id.notification_overview, open);
        return views;
    }
}
