export const KNOWLEDGE_COPY = {
  fr: {
    eyebrow: "Second cerveau", title: "Notes",
    hint: "Un dossier Markdown compatible Obsidian. Tes notes restent à toi : l’application écrit seulement dans « Tracker/ » (régénéré) et « Inbox/ » (nouvelles notes), jamais ailleurs.",
    capture: "Note rapide", capturePlaceholder: "Une idée, un résumé de cours, une réflexion… Les #tags deviennent des métadonnées.",
    save: "Enregistrer la note", saved: "Note créée : {path}",
    search: "Rechercher dans tes notes", filterByType: "Filtrer par type", searchPlaceholder: "Ex. martingales arrêt optionnel",
    recent: "Notes récentes", results: "Résultats", noResults: "Aucune note trouvée.",
    filters: { all: "Tout", note: "Mes notes", journal: "Journal", semaine: "Semaines", objectif: "Objectifs", "idée": "Idées" },
    why: "Pourquoi", sync: "Synchroniser", syncing: "Synchronisation…",
    syncReport: "{created} créées · {updated} mises à jour · {unchanged} inchangées",
    conflicts: "Notes non modifiées car leurs marqueurs Tracker ont été supprimés :",
    vault: "Coffre", notes: "notes", close: "Fermer", links: "Notes liées", readOnly: "Lecture seule — modifie la note dans Obsidian.",
    failed: "L’opération a échoué.", missingVault: "Le dossier sera créé à la première synchronisation."
  },
  en: {
    eyebrow: "Second brain", title: "Notes",
    hint: "An Obsidian-compatible Markdown folder. Your notes stay yours: the app only writes in “Tracker/” (regenerated) and “Inbox/” (new notes), never elsewhere.",
    capture: "Quick note", capturePlaceholder: "An idea, a lecture summary, a thought… #tags become metadata.",
    save: "Save note", saved: "Note created: {path}",
    search: "Search your notes", filterByType: "Filter by type", searchPlaceholder: "E.g. martingales optional stopping",
    recent: "Recent notes", results: "Results", noResults: "No note found.",
    filters: { all: "All", note: "My notes", journal: "Journal", semaine: "Weeks", objectif: "Goals", "idée": "Ideas" },
    why: "Why", sync: "Sync", syncing: "Syncing…",
    syncReport: "{created} created · {updated} updated · {unchanged} unchanged",
    conflicts: "Notes left untouched because their Tracker markers were removed:",
    vault: "Vault", notes: "notes", close: "Close", links: "Linked notes", readOnly: "Read-only — edit the note in Obsidian.",
    failed: "The operation failed.", missingVault: "The folder will be created on the first sync."
  }
};

export type KnowledgeCopy = (typeof KNOWLEDGE_COPY)["fr"];
