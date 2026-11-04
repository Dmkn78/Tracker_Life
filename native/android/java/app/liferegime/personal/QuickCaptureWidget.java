package app.liferegime.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** Home-screen strip: tap the field to add a task, the pencil to write a note. */
public final class QuickCaptureWidget extends AppWidgetProvider {
    private static final int TASK_REQUEST = 7201;
    private static final int NOTE_REQUEST = 7202;

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_capture);
        views.setOnClickPendingIntent(R.id.widget_add_task, captureIntent(context, QuickCaptureStore.TASK, TASK_REQUEST));
        views.setOnClickPendingIntent(R.id.widget_add_note, captureIntent(context, QuickCaptureStore.NOTE, NOTE_REQUEST));
        for (int widgetId : widgetIds) manager.updateAppWidget(widgetId, views);
    }

    private static PendingIntent captureIntent(Context context, String kind, int requestCode) {
        return PendingIntent.getActivity(context, requestCode, QuickCaptureActivity.intentFor(context, kind),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
