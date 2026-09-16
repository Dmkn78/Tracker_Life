package app.liferegime.personal;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.text.InputFilter;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/** A notification tap opens only this small input activity; no network is required. */
public final class QuickCaptureActivity extends Activity {
    private boolean saved = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setTitle("Nouvelle tâche");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (20 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, padding, padding, padding);
        layout.setBackgroundColor(Color.rgb(249, 244, 233));
        EditText title = new EditText(this);
        title.setHint("Qu’as-tu à faire ?");
        title.setSingleLine(true);
        title.setFilters(new InputFilter[]{new InputFilter.LengthFilter(500)});
        title.setImeOptions(EditorInfo.IME_ACTION_DONE);
        if (state != null) title.setText(state.getString("draft", ""));
        layout.addView(title);
        TextView detail = new TextView(this);
        detail.setText("Conservée sur le téléphone, puis ajoutée à l’entonnoir à la prochaine ouverture connectée.");
        detail.setTextSize(12);
        layout.addView(detail);
        Button add = new Button(this);
        add.setText("Ajouter");
        layout.addView(add);
        setContentView(layout);
        title.setId(android.R.id.edit);
        add.setOnClickListener(view -> save(title));
        title.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) { save(title); return true; }
            return false;
        });
        title.requestFocus();
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        title.post(() -> getSystemService(InputMethodManager.class).showSoftInput(title, InputMethodManager.SHOW_IMPLICIT));
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        EditText title = findViewById(android.R.id.edit);
        state.putString("draft", title.getText().toString());
        super.onSaveInstanceState(state);
    }

    private void save(EditText title) {
        if (saved) return;
        String scope = getSharedPreferences(QuickNotification.PREFERENCES, 0).getString("scope", "");
        try (QuickCaptureStore store = new QuickCaptureStore(this)) {
            store.capture(title.getText().toString(), scope);
            saved = true;
            Toast.makeText(this, "Tâche conservée", Toast.LENGTH_SHORT).show();
            finish();
        } catch (Exception exception) {
            title.setError("Impossible de conserver la tâche. Vérifie le titre et la connexion initiale de l’application.");
        }
    }
}
