"use client";

import { FieldLabel, TextArea, TextInput } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TodoTaskFields } from "../domain/todoTask";

export function TaskContentEditor({ fields, onChange, autoFocus = false }: {
  fields: TodoTaskFields;
  onChange: (fields: TodoTaskFields) => void;
  autoFocus?: boolean;
}) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const nameLabel = fr ? "Nom (facultatif)" : "Name (optional)";
  const descriptionLabel = "Description";
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 rounded-2xl bg-panel2/60 px-4 py-3 text-sm text-ink ring-1 ring-line">
        <input type="checkbox" checked={fields.isDay} onChange={(event) => onChange({ ...fields, isDay: event.target.checked })} className="h-4 w-4 accent-accent" />
        {fr ? "Journée — nom automatique" : "Day — automatic name"}
      </label>
      <div>
        <FieldLabel>{nameLabel}</FieldLabel>
        <TextInput
          aria-label={nameLabel}
          value={fields.isDay ? (fr ? "Journée" : "Day") : fields.title}
          disabled={fields.isDay}
          onChange={(event) => onChange({ ...fields, title: event.target.value })}
          className="mt-2"
          placeholder={fr ? "Tu peux laisser ce champ vide" : "You can leave this blank"}
        />
      </div>
      <div>
        <FieldLabel>{descriptionLabel}</FieldLabel>
        <TextArea
          aria-label={descriptionLabel}
          autoFocus={autoFocus}
          value={fields.description}
          onChange={(event) => onChange({ ...fields, descriptionChoice: "yes", description: event.target.value })}
          className="mt-2 min-h-[220px] resize-y"
          placeholder={fr ? "Écris librement ta journée, tes idées ou ce que tu veux faire…" : "Write freely about your day, your ideas or what you want to do…"}
        />
      </div>
    </div>
  );
}
