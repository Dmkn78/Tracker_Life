"use client";

import { useEffect, useState } from "react";
import { Card, Metric, ProgressBar } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { loadPlanning } from "@/features/objectives/api/planningApi";
import type { PlanningData } from "@/features/objectives/domain/planning";
import type { TodoTask, ObjectiveOption } from "../domain/todoTask";

export function TodoObjectiveTrajectory({ tasks, objectives, month }: { tasks: TodoTask[]; objectives: ObjectiveOption[]; month: string }) {
  const { locale } = useLocale();
  const fr = locale === "fr";
  const [planning, setPlanning] = useState<PlanningData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void loadPlanning(month, controller.signal).then((data) => {
      if (!controller.signal.aborted) setPlanning(data);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load trajectory");
    });
    return () => controller.abort();
  }, [tasks, month]);

  const linkedIds = new Set(tasks.map((task) => task.objectiveId));
  const insights = planning?.insights.filter((insight) => linkedIds.has(insight.objectiveId)) ?? [];
  if (!linkedIds.size || !tasks.some((task) => task.objectiveId)) return null;
  return <Card>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">{fr ? "Trajectoire des objectifs liés" : "Linked objective trajectory"}</h2>
      <a href="/objectives/forecasts" className="focus-ring text-xs text-accent">{fr ? "Ajuster les objectifs et les prévisions" : "Adjust objectives & forecasts"}</a>
    </div>
    <p className="mb-4 text-xs text-muted">{fr ? "Avancement global des objectifs, incluant leurs autres tâches. Les prévisions nécessitent un historique réel." : "Overall objective progress, including their other tasks. Forecasts require recorded history."}</p>
    {error ? <p role="alert" className="text-sm text-risk">{error}</p> : !planning ? <p role="status" className="text-sm text-muted">{fr ? "Chargement…" : "Loading…"}</p> : null}
    <div className="space-y-4">{insights.map((insight) => <div key={insight.objectiveId} className="rounded-2xl bg-panel2 p-4">
      <p className="mb-3 text-sm font-medium">{objectives.find((objective) => objective.id === insight.objectiveId)?.title ?? tasks.find((task) => task.objectiveId === insight.objectiveId)?.objectiveTitle}</p>
      <ProgressBar value={insight.progress} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={fr ? "Avancement / attendu" : "Progress / expected"} value={`${insight.progress}% / ${insight.expectedProgress === null ? "—" : `${insight.expectedProgress}%`}`} />
        <Metric label={fr ? "Vitesse par semaine" : "Weekly velocity"} value={insight.velocity === null ? "—" : `${insight.velocity.toFixed(1)} pts`} />
        <Metric label={fr ? "Évolution de la vitesse" : "Velocity change"} value={insight.momentum === null ? "—" : `${insight.momentum > 0 ? "+" : ""}${insight.momentum.toFixed(1)} pts`} />
        <Metric label={fr ? "Écart de progression" : "Progress gap"} value={insight.gap === null ? "—" : `${insight.gap > 0 ? "+" : ""}${insight.gap} pts`} />
      </div>
      <p className="mt-3 text-xs text-muted">{fr ? "Fin estimée" : "Forecast completion"} : {insight.forecastDate ?? (fr ? "historique insuffisant" : "insufficient history")}{insight.slipDays !== null ? ` · ${insight.slipDays > 0 ? "+" : ""}${insight.slipDays} ${fr ? "jours / cible" : "days vs target"}` : ""}</p>
    </div>)}</div>
  </Card>;
}
