"use client";

import { ChevronLeft, ChevronRight, HeartPulse, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel, GhostButton, Panel, PrimaryButton, SecondaryButton, SectionHeader, TextArea, TextInput } from "@/components/ui";
import { SliderField } from "@/components/SliderField";
import { loadEmotionalReview, saveEmotionalReview } from "@/features/emotional/api/emotionalReviewsApi";
import { emptyEmotionalReview, linesToItems, type EmotionalReview, type EmotionalReviewDraft } from "@/features/emotional/domain/emotionalReview";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { getIsoWeekId, getWeekDateKeys, shiftWeekId, toDateKey } from "@/lib/dates";
import { ApiError } from "@/lib/http/apiClient";

export function EmotionalReviewClient() {
  const { locale } = useLocale();
  const copy = EMOTIONAL_COPY[locale];
  const currentWeek = getIsoWeekId(toDateKey());
  const [weekId, setWeekId] = useState(currentWeek);
  const [draft, setDraft] = useState<EmotionalReviewDraft>(() => emptyEmotionalReview(currentWeek));
  const [stored, setStored] = useState<EmotionalReview | null>(null);
  const [status, setStatus] = useState<string>(copy.loading);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadControllerRef.current?.abort();
    loadControllerRef.current = controller;
    setLoading(true);
    setStatus(copy.loading);
    void loadEmotionalReview(weekId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setStored(response.review);
        setDraft(response.review ?? emptyEmotionalReview(response.weekId));
        setStatus(response.review ? copy.editing : copy.newReview);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatus(error instanceof ApiError ? error.message : copy.loadError);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [copy.editing, copy.loadError, copy.loading, copy.newReview, weekId]);

  function update(patch: Partial<EmotionalReviewDraft>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function save(): Promise<void> {
    if (saving) return;
    loadControllerRef.current?.abort();
    setSaving(true);
    setStatus(copy.saving);
    try {
      const saved = await saveEmotionalReview({
        ...draft,
        weekId,
        emotions: draft.emotions
          .map((emotion) => ({ ...emotion, name: emotion.name.trim() }))
          .filter((emotion) => emotion.name.length > 0)
      });
      setStored(saved);
      setDraft(saved);
      setStatus(copy.saved);
    } catch (error: unknown) {
      setStatus(error instanceof ApiError ? error.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  const dates = getWeekDateKeys(weekId);
  const weekLabel = `${dates[0]} — ${dates[6]}`;

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} detail={copy.detail} action={
        <PrimaryButton onClick={save} disabled={saving || loading}>
          <Save className="h-4 w-4" /> {stored ? copy.update : copy.save}
        </PrimaryButton>
      } />

      <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{weekId}</p>
          <p className="mt-1 font-semibold text-ink">{weekLabel}</p>
          <p role="status" className="mt-1 text-sm text-muted">{status}</p>
          {stored ? <p className="mt-1 text-xs text-muted">{copy.created} {new Date(stored.createdAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} · {copy.updated} {new Date(stored.updatedAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton disabled={saving} onClick={() => setWeekId((value) => shiftWeekId(value, -1))}><ChevronLeft className="h-4 w-4" /> {copy.previous}</SecondaryButton>
          <SecondaryButton disabled={saving} onClick={() => setWeekId(currentWeek)}>{copy.current}</SecondaryButton>
          <SecondaryButton disabled={saving} onClick={() => setWeekId((value) => shiftWeekId(value, 1))}>{copy.next} <ChevronRight className="h-4 w-4" /></SecondaryButton>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><HeartPulse className="h-5 w-5 text-accent" /> {copy.emotions}</h2>
              <p className="mt-1 text-sm text-muted">{copy.emotionsDetail}</p>
            </div>
            <SecondaryButton type="button" disabled={draft.emotions.length >= 12} onClick={() => update({ emotions: [...draft.emotions, { name: "", intensity: 3 }] })}><Plus className="h-4 w-4" /> {copy.add}</SecondaryButton>
          </div>
          <div className="space-y-2">
            {draft.emotions.length === 0 ? <p className="rounded-2xl bg-panel2/50 p-4 text-sm text-muted">{copy.noEmotion}</p> : draft.emotions.map((emotion, index) => (
              <div key={index} className="grid gap-2 rounded-2xl bg-panel2/50 p-3 sm:grid-cols-[1fr_130px_auto] sm:items-end">
                <div><FieldLabel>{copy.emotion}</FieldLabel><TextInput value={emotion.name} onChange={(event) => update({ emotions: draft.emotions.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} className="mt-2" /></div>
                <div><FieldLabel>{copy.intensity}</FieldLabel><select value={emotion.intensity} onChange={(event) => update({ emotions: draft.emotions.map((item, itemIndex) => itemIndex === index ? { ...item, intensity: Number(event.target.value) } : item) })} className="focus-ring mt-2 h-11 w-full rounded-2xl bg-shell px-3 text-ink ring-1 ring-line">{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></div>
                <GhostButton type="button" aria-label={copy.removeEmotion} onClick={() => update({ emotions: draft.emotions.filter((_, itemIndex) => itemIndex !== index) })} className="min-h-11 text-risk"><Trash2 className="h-4 w-4" /></GhostButton>
              </div>
            ))}
          </div>
          <SliderField label={copy.stress} value={draft.stressLevel} onChange={(stressLevel) => update({ stressLevel })} />
          <LineListField key={`${weekId}-factors`} label={copy.factors} help={copy.onePerLine} value={draft.factors} onChange={(factors) => update({ factors })} />
          <LineListField key={`${weekId}-triggers`} label={copy.triggers} help={copy.onePerLine} value={draft.triggers} onChange={(triggers) => update({ triggers })} />
        </Panel>

        <Panel className="space-y-5">
          <LineListField key={`${weekId}-mental`} label={copy.mentalSignals} help={copy.onePerLine} value={draft.mentalSignals} onChange={(mentalSignals) => update({ mentalSignals })} />
          <LineListField key={`${weekId}-physical`} label={copy.physicalSignals} help={copy.onePerLine} value={draft.physicalSignals} onChange={(physicalSignals) => update({ physicalSignals })} />
          <LineListField key={`${weekId}-helped`} label={copy.whatHelped} help={copy.onePerLine} value={draft.whatHelped} onChange={(whatHelped) => update({ whatHelped })} />
          <div><FieldLabel>{copy.nextAction}</FieldLabel><TextArea value={draft.nextWeekAction} onChange={(event) => update({ nextWeekAction: event.target.value })} className="mt-2 min-h-24" /></div>
          <div><FieldLabel>{copy.notes}</FieldLabel><TextArea value={draft.notes} onChange={(event) => update({ notes: event.target.value })} className="mt-2 min-h-32" /></div>
        </Panel>
      </div>
    </div>
  );
}

function LineListField({ label, help, value, onChange }: { label: string; help: string; value: string[]; onChange: (items: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  return <div><FieldLabel>{label}</FieldLabel><TextArea value={text} onChange={(event) => setText(event.target.value)} onBlur={() => onChange(linesToItems(text))} placeholder={help} className="mt-2 min-h-24" /></div>;
}

const EMOTIONAL_COPY = {
  en: { eyebrow: "Emotional", title: "Weekly emotional review", detail: "Name what you felt, what influenced it, and the signals worth noticing next week.", loading: "Loading…", editing: "Editing this week's saved review", newReview: "No saved review for this week", saving: "Saving…", saved: "Saved and editable", loadError: "Unable to load the review.", saveError: "Unable to save the review.", save: "Save review", update: "Update review", previous: "Previous", current: "Current week", next: "Next", created: "Created", updated: "Updated", emotions: "Emotions felt", emotionsDetail: "Add up to 12 emotions and rate each from 1 to 5.", add: "Add", noEmotion: "No emotion added yet.", emotion: "Emotion", intensity: "Intensity", removeEmotion: "Remove emotion", stress: "Mental stress", factors: "Associated reasons or factors", triggers: "Triggers", mentalSignals: "Mental signals", physicalSignals: "Physical signals", whatHelped: "What helped", nextAction: "One action for next week", notes: "Additional notes", onePerLine: "One item per line" },
  fr: { eyebrow: "Émotionnel", title: "Bilan émotionnel hebdomadaire", detail: "Nommez ce que vous avez ressenti, les facteurs associés et les signaux à observer la semaine suivante.", loading: "Chargement…", editing: "Modification du bilan enregistré de cette semaine", newReview: "Aucun bilan enregistré pour cette semaine", saving: "Enregistrement…", saved: "Enregistré et modifiable", loadError: "Impossible de charger le bilan.", saveError: "Impossible d’enregistrer le bilan.", save: "Enregistrer le bilan", update: "Mettre à jour le bilan", previous: "Précédente", current: "Semaine actuelle", next: "Suivante", created: "Créé", updated: "Modifié", emotions: "Émotions ressenties", emotionsDetail: "Ajoutez jusqu’à 12 émotions et notez leur intensité de 1 à 5.", add: "Ajouter", noEmotion: "Aucune émotion ajoutée.", emotion: "Émotion", intensity: "Intensité", removeEmotion: "Retirer l’émotion", stress: "Stress mental", factors: "Raisons ou facteurs associés", triggers: "Déclencheurs", mentalSignals: "Signaux mentaux", physicalSignals: "Signaux physiques", whatHelped: "Ce qui a aidé", nextAction: "Une action pour la semaine suivante", notes: "Notes complémentaires", onePerLine: "Un élément par ligne" }
} as const;
