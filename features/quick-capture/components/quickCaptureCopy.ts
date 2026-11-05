export const QUICK_CAPTURE_COPY = {
  fr: {
    open: "Ajouter rapidement", close: "Fermer", kinds: { task: "Tâche", note: "Note" },
    placeholders: { task: "Qu’as-tu à faire ?", note: "Note ce qui te passe par la tête… (#tags facultatifs)" },
    when: { today: "Aujourd’hui", tomorrow: "Demain", later: "Plus tard" },
    whenLabel: "Quand", kindLabel: "Type d’ajout", add: "Ajouter", saving: "Ajout…",
    dictate: "Dicter", hideDictation: "Masquer la dictée",
    savedTask: { today: "Ajoutée à aujourd’hui", tomorrow: "Ajoutée à demain", later: "Ajoutée à « À planifier »" },
    savedNote: "Note enregistrée dans Inbox", queued: "Pas de connexion : conservé sur le téléphone, envoyé dès le retour du réseau",
    noteHint: "Ctrl + Entrée pour enregistrer", taskHint: "Entrée pour ajouter, puis enchaîne", failed: "L’ajout a échoué."
  },
  en: {
    open: "Quick add", close: "Close", kinds: { task: "Task", note: "Note" },
    placeholders: { task: "What do you need to do?", note: "Write whatever comes to mind… (optional #tags)" },
    when: { today: "Today", tomorrow: "Tomorrow", later: "Later" },
    whenLabel: "When", kindLabel: "What to add", add: "Add", saving: "Adding…",
    dictate: "Dictate", hideDictation: "Hide dictation",
    savedTask: { today: "Added to today", tomorrow: "Added to tomorrow", later: "Added to “To schedule”" },
    savedNote: "Note saved to Inbox", queued: "Offline: kept on the phone, sent when the network is back",
    noteHint: "Ctrl + Enter to save", taskHint: "Enter to add, then keep going", failed: "Adding failed."
  }
};

export type QuickCaptureCopy = (typeof QUICK_CAPTURE_COPY)["fr"];
