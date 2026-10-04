"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { GhostButton, SecondaryButton, SelectInput, TextInput } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { deleteTodoTemplate, listTodoTemplates, saveTodoTemplate } from "../api/todoTemplatesApi";
import { hasTodoTaskContent, type TodoTaskFields } from "../domain/todoTask";
import { applyTodoTemplate, type TodoTemplate } from "../domain/todoTemplate";

export function TodoTemplatePanel({ fields, onChange }: {
  fields: TodoTaskFields;
  onChange: (fields: TodoTaskFields) => void;
}) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const [templates, setTemplates] = useState<TodoTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listTodoTemplates(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) setTemplates(loaded);
    }).catch(() => {
      if (!controller.signal.aborted) setError(fr ? "Impossible de charger les modèles." : "Unable to load templates.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [fr]);

  async function saveTemplate(): Promise<void> {
    if (!name.trim() || !hasTodoTaskContent(fields)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await saveTodoTemplate(name.trim(), fields);
      setTemplates((current) => [...current, saved]);
      setName("");
      setNotice(fr ? "Modèle enregistré. Tu peux continuer à écrire ou créer la tâche." : "Template saved. You can keep writing or create the task.");
    } catch {
      setError(fr ? "Impossible d’enregistrer le modèle." : "Unable to save the template.");
    } finally { setBusy(false); }
  }

  async function removeTemplate(): Promise<void> {
    const template = templates.find((candidate) => candidate.id === selectedId);
    if (!template || !window.confirm(fr ? `Supprimer le modèle « ${template.name} » ?` : `Delete template “${template.name}”?`)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await deleteTodoTemplate(template.id);
      setTemplates((current) => current.filter((candidate) => candidate.id !== template.id));
      setSelectedId("");
    } catch {
      setError(fr ? "Impossible de supprimer le modèle." : "Unable to delete the template.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-panel2/40 p-4 ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">{fr ? "Modèles de tâche ou de journée" : "Task or day templates"}</p>
      <div className="flex flex-wrap gap-2">
        <SelectInput aria-label={fr ? "Choisir un modèle" : "Choose a template"} disabled={loading || busy} className="min-w-0 flex-1" value={selectedId} onChange={(event) => {
          const id = event.target.value;
          setSelectedId(id); setNotice(null);
          if (id === "day") {
            onChange({ ...fields, title: "", isDay: true, descriptionChoice: "yes", description: fr ? "Matin :\n\nAprès-midi :\n\nSoir :" : "Morning:\n\nAfternoon:\n\nEvening:" });
          } else {
            const template = templates.find((candidate) => candidate.id === id);
            if (template) onChange(applyTodoTemplate(template, fields));
          }
        }}>
          <option value="">{loading ? (fr ? "Chargement…" : "Loading…") : (fr ? "Utiliser un modèle…" : "Use a template…")}</option>
          <option value="day">{fr ? "Journée (modèle de départ)" : "Day (starter template)"}</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </SelectInput>
        {selectedId && selectedId !== "day" ? <GhostButton type="button" disabled={busy} aria-label={fr ? "Supprimer le modèle" : "Delete template"} onClick={() => void removeTemplate()}><Trash2 className="h-4 w-4" /></GhostButton> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <TextInput aria-label={fr ? "Nom du modèle" : "Template name"} maxLength={120} className="min-w-0 flex-1" value={name} onChange={(event) => setName(event.target.value)} placeholder={fr ? "Ex. Journée de travail" : "E.g. Work day"} />
        <SecondaryButton type="button" disabled={busy || !name.trim() || !hasTodoTaskContent(fields)} onClick={() => void saveTemplate()}>{fr ? "Enregistrer comme modèle" : "Save as template"}</SecondaryButton>
      </div>
      {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-accent">{notice}</p> : null}
    </div>
  );
}
