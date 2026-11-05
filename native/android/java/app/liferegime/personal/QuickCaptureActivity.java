package app.liferegime.personal;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Bottom input strip opened by the home-screen widget or the notification: one field, no network needed.
 * The capture is stored in the outbox, then sent right away when the app session allows it.
 */
public final class QuickCaptureActivity extends Activity {
    static final String EXTRA_KIND = "app.liferegime.personal.CAPTURE_KIND";
    private static final int PANEL = Color.rgb(27, 33, 48);
    private static final int FIELD = Color.rgb(36, 43, 61);
    private static final int ACCENT = Color.rgb(141, 162, 251);
    private static final int TEXT = Color.rgb(232, 235, 245);
    private static final int MUTED = Color.rgb(154, 163, 184);
    private static final String[] WHEN_LABELS = {"Aujourd’hui", "Demain", "Plus tard"};

    private String kind = QuickCaptureStore.TASK;
    private int whenIndex = 0;
    private boolean saved = false;
    private EditText field;
    private TextView taskTab;
    private TextView noteTab;
    private LinearLayout whenRow;
    private final TextView[] whenChips = new TextView[WHEN_LABELS.length];

    static Intent intentFor(Context context, String kind) {
        return new Intent(context, QuickCaptureActivity.class)
            .putExtra(EXTRA_KIND, kind)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        kind = QuickCaptureStore.NOTE.equals(getIntent().getStringExtra(EXTRA_KIND)) ? QuickCaptureStore.NOTE : QuickCaptureStore.TASK;
        if (state != null) {
            kind = state.getString("kind", kind);
            whenIndex = state.getInt("when", 0);
        }
        setContentView(buildPanel());
        if (state != null) field.setText(state.getString("draft", ""));
        placeAtBottom();
        applyKind();
        field.requestFocus();
        field.post(() -> getSystemService(InputMethodManager.class).showSoftInput(field, InputMethodManager.SHOW_IMPLICIT));
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putString("draft", field.getText().toString());
        state.putString("kind", kind);
        state.putInt("when", whenIndex);
        super.onSaveInstanceState(state);
    }

    private View buildPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(16);
        panel.setPadding(padding, dp(12), padding, padding);
        panel.setBackground(rounded(PANEL, dp(24), true));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        taskTab = pill("Tâche", view -> { kind = QuickCaptureStore.TASK; applyKind(); });
        noteTab = pill("Note", view -> { kind = QuickCaptureStore.NOTE; applyKind(); });
        header.addView(taskTab);
        header.addView(noteTab, spaced());
        View spacer = new View(this);
        header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
        TextView save = pill("Ajouter  ↵", view -> save());
        save.setTextColor(Color.rgb(17, 21, 31));
        save.setBackground(rounded(ACCENT, dp(18), false));
        header.addView(save);
        panel.addView(header);

        field = new EditText(this);
        field.setId(android.R.id.edit);
        field.setTextColor(TEXT);
        field.setHintTextColor(MUTED);
        field.setTextSize(18);
        field.setPadding(dp(14), dp(12), dp(14), dp(12));
        field.setBackground(rounded(FIELD, dp(16), false));
        field.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) { save(); return true; }
            return false;
        });
        LinearLayout.LayoutParams fieldLayout = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        fieldLayout.topMargin = dp(12);
        panel.addView(field, fieldLayout);

        whenRow = new LinearLayout(this);
        for (int index = 0; index < WHEN_LABELS.length; index++) {
            final int chipIndex = index;
            whenChips[index] = pill(WHEN_LABELS[index], view -> { whenIndex = chipIndex; applyKind(); });
            whenRow.addView(whenChips[index], index == 0 ? new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT) : spaced());
        }
        LinearLayout.LayoutParams rowLayout = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rowLayout.topMargin = dp(10);
        panel.addView(whenRow, rowLayout);
        return panel;
    }

    private void placeAtBottom() {
        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        window.setGravity(Gravity.BOTTOM);
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        window.setDimAmount(0.45f);
        window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private void applyKind() {
        boolean isNote = QuickCaptureStore.NOTE.equals(kind);
        styleSelected(taskTab, !isNote);
        styleSelected(noteTab, isNote);
        for (int index = 0; index < whenChips.length; index++) styleSelected(whenChips[index], index == whenIndex);
        whenRow.setVisibility(isNote ? View.GONE : View.VISIBLE);
        field.setHint(isNote ? "Note ce qui te passe par la tête…" : "Qu’as-tu à faire ?");
        field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(isNote ? 50_000 : 500)});
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | (isNote ? InputType.TYPE_TEXT_FLAG_MULTI_LINE : 0));
        field.setImeOptions(isNote ? EditorInfo.IME_ACTION_NONE : EditorInfo.IME_ACTION_DONE);
        field.setMinLines(isNote ? 4 : 1);
        field.setMaxLines(isNote ? 10 : 3);
        field.setGravity(Gravity.TOP | Gravity.START);
    }

    private void save() {
        if (saved) return;
        String scope = getSharedPreferences(QuickNotification.PREFERENCES, 0).getString("scope", "");
        if (scope.isEmpty()) {
            field.setError("Ouvre d’abord Life Regime pour connecter ton serveur.");
            return;
        }
        boolean isNote = QuickCaptureStore.NOTE.equals(kind);
        try (QuickCaptureStore store = new QuickCaptureStore(this)) {
            store.capture(null, kind, field.getText().toString(), isNote ? null : selectedDate(), scope);
            saved = true;
        } catch (IllegalArgumentException exception) {
            field.setError(isNote ? "La note est vide." : "Écris la tâche (500 caractères au plus).");
            return;
        } catch (Exception exception) {
            field.setError("Impossible de conserver l’ajout sur le téléphone.");
            return;
        }
        QuickNotification.refresh(this);
        QuickCaptureSync.sendPendingInBackground(this);
        Toast.makeText(this, isNote ? "Note ajoutée" : "Tâche ajoutée · " + WHEN_LABELS[whenIndex].toLowerCase(Locale.FRENCH), Toast.LENGTH_SHORT).show();
        finish();
    }

    /** Today, tomorrow, or null for "Plus tard" (the task lands in "À planifier"). */
    private String selectedDate() {
        if (whenIndex == 2) return null;
        Calendar day = Calendar.getInstance();
        day.add(Calendar.DAY_OF_MONTH, whenIndex);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(day.getTime());
    }

    private TextView pill(String label, View.OnClickListener listener) {
        TextView pill = new TextView(this);
        pill.setText(label);
        pill.setTextSize(15);
        pill.setGravity(Gravity.CENTER);
        pill.setMinHeight(dp(40));
        pill.setPadding(dp(16), dp(8), dp(16), dp(8));
        pill.setOnClickListener(listener);
        styleSelected(pill, false);
        return pill;
    }

    private void styleSelected(TextView pill, boolean isSelected) {
        pill.setTextColor(isSelected ? TEXT : MUTED);
        GradientDrawable background = rounded(isSelected ? FIELD : Color.TRANSPARENT, dp(18), false);
        background.setStroke(dp(1), isSelected ? ACCENT : Color.rgb(58, 66, 88));
        pill.setBackground(background);
    }

    private LinearLayout.LayoutParams spaced() {
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        layout.leftMargin = dp(8);
        return layout;
    }

    private GradientDrawable rounded(int color, int radius, boolean isTopOnly) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        if (isTopOnly) drawable.setCornerRadii(new float[]{radius, radius, radius, radius, 0, 0, 0, 0});
        else drawable.setCornerRadius(radius);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
