export const PLANNING_COPY = {
  fr: {
    eyebrow: "Planifier", hint: "Écris tes tâches dans la liste, puis glisse-les sur un jour. Sur téléphone, touche « Planifier » et choisis le jour. Change de semaine pour planifier à l’avance.",
    backlog: "Tâches à planifier", backlogEmpty: "Rien à planifier. Ajoute une tâche ci-dessus.", noGoal: "Sans objectif",
    addPlaceholder: "Nouvelle tâche…", add: "Ajouter", goal: "Objectif (facultatif)", noGoalOption: "Aucun objectif",
    plan: "Planifier", choose: "Choisir le jour", unplan: "Remettre dans la liste", remove: "Supprimer", done: "Marquer comme faite", reopen: "Rouvrir",
    dayEmpty: "Dépose une tâche ici", confirmRemove: "Supprimer cette tâche ?", forecasts: "Vue détaillée des objectifs (jalons, prévisions)", today: "Aujourd’hui"
  },
  en: {
    eyebrow: "Plan", hint: "Write tasks in the list, then drag them onto a day. On a phone, tap “Plan” and pick the day. Switch weeks to plan ahead.",
    backlog: "Tasks to schedule", backlogEmpty: "Nothing to schedule. Add a task above.", noGoal: "No goal",
    addPlaceholder: "New task…", add: "Add", goal: "Goal (optional)", noGoalOption: "No goal",
    plan: "Plan", choose: "Pick the day", unplan: "Back to the list", remove: "Delete", done: "Mark as done", reopen: "Reopen",
    dayEmpty: "Drop a task here", confirmRemove: "Delete this task?", forecasts: "Detailed goal view (milestones, forecasts)", today: "Today"
  }
};

export type PlanningCopy = (typeof PLANNING_COPY)["fr"];
