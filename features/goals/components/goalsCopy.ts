export const GOALS_COPY = {
  fr: {
    eyebrow: "Direction", title: "Objectifs",
    hint: "Une phrase suffit. Les tâches s’y rattachent quand tu le souhaites ; rien n’est obligatoire.",
    placeholder: "Quel objectif veux-tu atteindre ? Ex. Améliorer ma maîtrise des processus stochastiques",
    add: "Ajouter", empty: "Aucun objectif pour l’instant. Commence par une phrase.",
    progress: "{done}/{total} tâches faites", noTasks: "Aucune tâche liée", unscheduled: "à planifier",
    addStep: "Ajouter une étape", stepPlaceholder: "Prochaine étape concrète…",
    propose: "Proposer des étapes", proposing: "Réflexion…", proposalsTitle: "Étapes proposées par l’IA",
    proposalsHint: "Modifie ou décoche avant d’ajouter. Les étapes arrivent dans « À planifier » de ta semaine.",
    addSelected: "Ajouter les étapes choisies ({count})", discard: "Ignorer", needsAi: "Configure un modèle d’IA dans Réglages pour obtenir des propositions.",
    markDone: "Atteint", reopen: "Rouvrir", archive: "Archiver", confirmArchive: "Archiver cet objectif ? Ses tâches sont conservées.",
    doneSection: "Objectifs atteints", rename: "Renommer", loading: "Chargement…", failed: "L’opération a échoué.",
    advanced: "Planification détaillée (horizons, jalons, prévisions)"
  },
  en: {
    eyebrow: "Direction", title: "Goals",
    hint: "One sentence is enough. Tasks can be linked whenever you want; nothing is mandatory.",
    placeholder: "What do you want to achieve? E.g. Get better at stochastic processes",
    add: "Add", empty: "No goals yet. Start with one sentence.",
    progress: "{done}/{total} tasks done", noTasks: "No linked task", unscheduled: "to schedule",
    addStep: "Add a step", stepPlaceholder: "Next concrete step…",
    propose: "Suggest steps", proposing: "Thinking…", proposalsTitle: "Steps suggested by AI",
    proposalsHint: "Edit or untick before adding. Steps land in “To schedule” on your week.",
    addSelected: "Add selected steps ({count})", discard: "Dismiss", needsAi: "Configure an AI model in Settings to get suggestions.",
    markDone: "Achieved", reopen: "Reopen", archive: "Archive", confirmArchive: "Archive this goal? Its tasks are kept.",
    doneSection: "Achieved goals", rename: "Rename", loading: "Loading…", failed: "The operation failed.",
    advanced: "Detailed planning (horizons, milestones, forecasts)"
  }
};

export type GoalsCopy = (typeof GOALS_COPY)["fr"];
