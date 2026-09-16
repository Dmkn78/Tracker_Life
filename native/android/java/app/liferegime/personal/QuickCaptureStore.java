package app.liferegime.personal;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.UUID;

/** Durable outbox. A capture is removed only after the server acknowledges its UUID. */
public final class QuickCaptureStore extends SQLiteOpenHelper {
    public QuickCaptureStore(Context context) { super(context, "quick-captures.db", null, 1); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE captures (id TEXT PRIMARY KEY, title TEXT NOT NULL, scope TEXT NOT NULL, createdAt INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }

    public void capture(String title, String scope) {
        String trimmed = title.trim();
        if (trimmed.isEmpty() || trimmed.length() > 500 || scope.isEmpty()) throw new IllegalArgumentException("Titre ou serveur manquant");
        ContentValues capture = new ContentValues();
        capture.put("id", UUID.randomUUID().toString());
        capture.put("title", trimmed);
        capture.put("scope", scope);
        capture.put("createdAt", System.currentTimeMillis());
        getWritableDatabase().insertOrThrow("captures", null, capture);
    }

    public JSArray list(String scope) {
        JSArray captures = new JSArray();
        try (Cursor cursor = getReadableDatabase().query("captures", null, "scope = ?", new String[]{scope}, null, null, "createdAt ASC")) {
            while (cursor.moveToNext()) {
                JSObject capture = new JSObject();
                capture.put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")));
                capture.put("title", cursor.getString(cursor.getColumnIndexOrThrow("title")));
                capture.put("scope", scope);
                capture.put("createdAt", cursor.getLong(cursor.getColumnIndexOrThrow("createdAt")));
                captures.put(capture);
            }
        }
        return captures;
    }

    public void acknowledge(String id, String scope) {
        getWritableDatabase().delete("captures", "id = ? AND scope = ?", new String[]{id, scope});
    }
}
