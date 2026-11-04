package app.liferegime.personal;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/** Durable outbox. A capture is removed only after the server acknowledges its UUID. */
public final class QuickCaptureStore extends SQLiteOpenHelper {
    static final String TASK = "task";
    static final String NOTE = "note";
    private static final int SCHEMA_VERSION = 2;
    private static final int MAX_TASK_LENGTH = 500;
    private static final int MAX_NOTE_LENGTH = 50_000;
    private static final Pattern DATE_KEY = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final Pattern CAPTURE_ID = Pattern.compile("[0-9a-fA-F-]{36}");

    /** One pending capture, as sent to the server. */
    static final class PendingCapture {
        final String id;
        final String kind;
        final String title;
        final String date;

        PendingCapture(String id, String kind, String title, String date) {
            this.id = id;
            this.kind = kind;
            this.title = title;
            this.date = date;
        }
    }

    public QuickCaptureStore(Context context) { super(context, "quick-captures.db", null, SCHEMA_VERSION); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE captures (id TEXT PRIMARY KEY, title TEXT NOT NULL, scope TEXT NOT NULL, createdAt INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'task', date TEXT)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Version 1 stored undated tasks only; existing rows keep that meaning.
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE captures ADD COLUMN kind TEXT NOT NULL DEFAULT 'task'");
            db.execSQL("ALTER TABLE captures ADD COLUMN date TEXT");
        }
    }

    /** Stores a capture; `id` may be null (a new UUID is generated) and `date` is null for notes and undated tasks. */
    public String capture(String id, String kind, String title, String date, String scope) {
        String trimmed = title == null ? "" : title.trim();
        boolean isNote = NOTE.equals(kind);
        if (!isNote && !TASK.equals(kind)) throw new IllegalArgumentException("Type de capture inconnu");
        int maximumLength = isNote ? MAX_NOTE_LENGTH : MAX_TASK_LENGTH;
        if (trimmed.isEmpty() || trimmed.length() > maximumLength || scope == null || scope.isEmpty()) throw new IllegalArgumentException("Texte ou serveur manquant");
        if (date != null && (isNote || !DATE_KEY.matcher(date).matches())) throw new IllegalArgumentException("Date invalide");
        String captureId = id == null || id.isEmpty() ? UUID.randomUUID().toString() : id;
        if (!CAPTURE_ID.matcher(captureId).matches()) throw new IllegalArgumentException("Identifiant invalide");
        ContentValues capture = new ContentValues();
        capture.put("id", captureId);
        capture.put("kind", kind);
        capture.put("title", trimmed);
        capture.put("date", date);
        capture.put("scope", scope);
        capture.put("createdAt", System.currentTimeMillis());
        getWritableDatabase().insertOrThrow("captures", null, capture);
        return captureId;
    }

    public List<PendingCapture> pending(String scope) {
        List<PendingCapture> captures = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query("captures", null, "scope = ?", new String[]{scope}, null, null, "createdAt ASC")) {
            while (cursor.moveToNext()) {
                captures.add(new PendingCapture(
                    cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    cursor.getString(cursor.getColumnIndexOrThrow("kind")),
                    cursor.getString(cursor.getColumnIndexOrThrow("title")),
                    cursor.getString(cursor.getColumnIndexOrThrow("date"))
                ));
            }
        }
        return captures;
    }

    public JSArray list(String scope) {
        JSArray captures = new JSArray();
        try (Cursor cursor = getReadableDatabase().query("captures", null, "scope = ?", new String[]{scope}, null, null, "createdAt ASC")) {
            while (cursor.moveToNext()) {
                JSObject capture = new JSObject();
                capture.put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")));
                capture.put("kind", cursor.getString(cursor.getColumnIndexOrThrow("kind")));
                capture.put("title", cursor.getString(cursor.getColumnIndexOrThrow("title")));
                String date = cursor.getString(cursor.getColumnIndexOrThrow("date"));
                capture.put("date", date == null ? JSObject.NULL : date);
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

    public int pendingCount(String scope) {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM captures WHERE scope = ?", new String[]{scope})) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }
}
