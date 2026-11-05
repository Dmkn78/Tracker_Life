export const COURSES_COPY = {
  fr: {
    eyebrow: "Études", title: "Cours",
    hint: "Ajoute tes cours puis leurs dates importantes. Chaque date peut être envoyée dans Google Agenda ; elles apparaissent aussi sur ta semaine.",
    addCourse: "Ajouter", coursePlaceholder: "Nom du cours, ex. Processus stochastiques", empty: "Aucun cours pour l’instant.",
    upcoming: "Prochaines échéances", noUpcoming: "Aucune échéance dans les 60 prochains jours.", otherDates: "Autres dates importantes",
    kinds: { exam: "Examen", assignment: "Rendu", other: "Date importante" },
    addDeadline: "Ajouter une date", deadlineTitle: "Quoi ? ex. Partiel chapitres 1 à 4", date: "Date", time: "Heure (facultative)", save: "Ajouter", cancel: "Annuler",
    googleCalendar: "Ajouter à Google Agenda", exportAll: "Tout exporter (.ics)", exportHint: "Fichier à importer dans Google Agenda (agenda.google.com → Paramètres → Importer) ou à ouvrir sur le téléphone.",
    today: "aujourd’hui", tomorrow: "demain", inDays: "dans {count} j", daysAgo: "il y a {count} j",
    removeCourse: "Supprimer le cours", confirmRemoveCourse: "Supprimer ce cours et toutes ses dates ?", removeDeadline: "Supprimer", confirmRemoveDeadline: "Supprimer cette date ?",
    rename: "Renommer", loading: "Chargement…", failed: "L’opération a échoué.", past: "Passées"
  },
  en: {
    eyebrow: "Studies", title: "Courses",
    hint: "Add your courses, then their important dates. Each date can be sent to Google Calendar; they also show on your week.",
    addCourse: "Add", coursePlaceholder: "Course name, e.g. Stochastic processes", empty: "No course yet.",
    upcoming: "Upcoming dates", noUpcoming: "Nothing in the next 60 days.", otherDates: "Other important dates",
    kinds: { exam: "Exam", assignment: "Submission", other: "Important date" },
    addDeadline: "Add a date", deadlineTitle: "What? e.g. Midterm chapters 1–4", date: "Date", time: "Time (optional)", save: "Add", cancel: "Cancel",
    googleCalendar: "Add to Google Calendar", exportAll: "Export all (.ics)", exportHint: "File to import into Google Calendar (calendar.google.com → Settings → Import) or open on your phone.",
    today: "today", tomorrow: "tomorrow", inDays: "in {count} d", daysAgo: "{count} d ago",
    removeCourse: "Delete course", confirmRemoveCourse: "Delete this course and all its dates?", removeDeadline: "Delete", confirmRemoveDeadline: "Delete this date?",
    rename: "Rename", loading: "Loading…", failed: "The operation failed.", past: "Past"
  }
};

export type CoursesCopy = (typeof COURSES_COPY)["fr"];
