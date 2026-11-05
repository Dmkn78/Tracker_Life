export const WEEK_COPY = {
  fr: {
    eyebrow: "Ma semaine", previousWeek: "Semaine précédente", nextWeek: "Semaine suivante", thisWeek: "Cette semaine",
    capturePlaceholder: "Qu’as-tu à faire ? Ex. Revoir le chapitre sur les martingales et refaire les exercices 3 et 4",
    captureLabel: "Nouvelle tâche", captureFor: "Pour", add: "Ajouter", addTo: "Ajouter une tâche",
    inbox: "À planifier", inboxHint: "Sans date. Glisse une tâche vers un jour quand tu sais quand la faire.",
    today: "Aujourd’hui", empty: "Rien de prévu", done: "faites", progress: "{done}/{planned} faites",
    recap: "Récap", dayRecapPlaceholder: "Ce qui s’est passé, ce qui a bloqué… (facultatif)",
    weekRecap: "Récapitulatif de la semaine", weekRecapPlaceholder: "Bilan libre de la semaine : ce qui a marché, ce qui a coincé, ce que tu changes (facultatif)",
    saved: "Enregistré", toggle: "Marquer comme faite", reopen: "Rouvrir", notDone: "Pas faite", remove: "Supprimer",
    moveEarlier: "Jour précédent", moveLater: "Jour suivant", edit: "Modifier", loading: "Chargement de la semaine…",
    failed: "Impossible de charger la semaine.", retry: "Réessayer", confirmRemove: "Supprimer cette tâche ?", dragHint: "Glisse les tâches d’un jour à l’autre.",
    linkedGoal: "Objectif", planAhead: "Planifier"
  },
  en: {
    eyebrow: "My week", previousWeek: "Previous week", nextWeek: "Next week", thisWeek: "This week",
    capturePlaceholder: "What do you need to do? E.g. Review the martingales chapter and redo exercises 3 and 4",
    captureLabel: "New task", captureFor: "For", add: "Add", addTo: "Add a task",
    inbox: "To schedule", inboxHint: "Undated. Drag a task onto a day once you know when.",
    today: "Today", empty: "Nothing planned", done: "done", progress: "{done}/{planned} done",
    recap: "Recap", dayRecapPlaceholder: "What happened, what blocked you… (optional)",
    weekRecap: "Weekly recap", weekRecapPlaceholder: "Free review of the week: what worked, what got stuck, what you change (optional)",
    saved: "Saved", toggle: "Mark as done", reopen: "Reopen", notDone: "Not done", remove: "Delete",
    moveEarlier: "Previous day", moveLater: "Next day", edit: "Edit", loading: "Loading the week…",
    failed: "The week could not be loaded.", retry: "Retry", confirmRemove: "Delete this task?", dragHint: "Drag tasks from one day to another.",
    linkedGoal: "Goal", planAhead: "Plan"
  }
};

export type WeekCopy = (typeof WEEK_COPY)["fr"];
