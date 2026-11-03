export const INSIGHTS_COPY = {
  fr: {
    eyebrow: "Comprendre", title: "Analyser",
    hint: "Les constats ci-dessous sont calculés directement à partir de tes données, sans IA. L’IA ne sert qu’à répondre à tes questions, en citant ses sources.",
    period: "Période", days: "{count} jours",
    computed: "Constats calculés", completion: "{done}/{planned} tâches faites ({rate} %)", recapDays: "{count} jours avec récap sur {total}",
    byWeekday: "Par jour de semaine", recurring: "Tâches récurrentes", postponed: "Tâches souvent reportées", blockers: "Blocages récurrents",
    keywords: "Mots fréquents dans les blocages", goals: "Activité par objectif", idleGoals: "Objectifs sans tâche sur la période",
    times: "×{count}", doneOf: "{done} faites", noActivity: "Pas encore de données sur cette période. Ajoute des tâches et quelques récaps : les constats apparaîtront ici.",
    ask: "Poser une question à ton historique", askPlaceholder: "Ex. Qu’est-ce qui m’a le plus bloqué ce mois-ci ?", askButton: "Analyser", asking: "Analyse en cours…", cancel: "Annuler",
    quickQuestions: ["Fais la synthèse de la période.", "Qu’est-ce qui me bloque de façon répétée ?", "Compare ce que j’avais prévu et ce que j’ai réellement fait.", "Que devrais-je ajuster la semaine prochaine ?"],
    needsAi: "Configure un modèle d’IA dans Réglages pour poser des questions. Les constats calculés restent disponibles sans IA.",
    summary: "Réponse", facts: "Faits enregistrés", hypotheses: "Hypothèses de l’IA", recommendations: "Recommandations",
    unverified: "Affirmations écartées (aucune source valide)", sources: "Sources utilisées", truncated: "Historique volumineux : seules les données les plus récentes ont été transmises.",
    evidence: "{count} éléments transmis au modèle", openNote: "Ouvrir la note", failed: "L’analyse a échoué."
  },
  en: {
    eyebrow: "Understand", title: "Analyse",
    hint: "The findings below are computed directly from your data, without AI. AI is only used to answer your questions, citing its sources.",
    period: "Period", days: "{count} days",
    computed: "Computed findings", completion: "{done}/{planned} tasks done ({rate}%)", recapDays: "{count} days with a recap out of {total}",
    byWeekday: "By weekday", recurring: "Recurring tasks", postponed: "Often postponed tasks", blockers: "Recurring blockers",
    keywords: "Frequent words in blockers", goals: "Activity per goal", idleGoals: "Goals without tasks in this period",
    times: "×{count}", doneOf: "{done} done", noActivity: "No data for this period yet. Add tasks and a few recaps: findings will appear here.",
    ask: "Ask your history", askPlaceholder: "E.g. What blocked me the most this month?", askButton: "Analyse", asking: "Analysing…", cancel: "Cancel",
    quickQuestions: ["Summarise this period.", "What keeps blocking me?", "Compare what I planned with what I actually did.", "What should I adjust next week?"],
    needsAi: "Configure an AI model in Settings to ask questions. Computed findings stay available without AI.",
    summary: "Answer", facts: "Recorded facts", hypotheses: "AI hypotheses", recommendations: "Recommendations",
    unverified: "Discarded claims (no valid source)", sources: "Sources used", truncated: "Large history: only the most recent data was sent.",
    evidence: "{count} items sent to the model", openNote: "Open note", failed: "The analysis failed."
  }
};

export type InsightsCopy = (typeof INSIGHTS_COPY)["fr"];
