import type { MobilePage } from "./routes";

const sections: { page: MobilePage; title: string; description: string }[] = [
  { page: "home", title: "Accueil", description: "Synthèse de la journée" },
  { page: "life-terminal", title: "Life Terminal", description: "Indicateurs, contexte et exécution" },
  { page: "life", title: "Trajectoire", description: "État, risques et évolution" },
  { page: "daily-log", title: "Logs quotidiens", description: "Sommeil, énergie, travail et bilan" },
  { page: "history", title: "Historique", description: "Retrouver et modifier les anciens logs" },
  { page: "emotional", title: "Émotions", description: "Journal et analyse émotionnelle" },
  { page: "thinking", title: "Réflexions", description: "Notes et idées" },
  { page: "habits", title: "Habitudes", description: "Routines et suivi" },
  { page: "time-allocation", title: "Répartition du temps", description: "Budgets et temps réellement passé" },
  { page: "calendar", title: "Calendrier", description: "Événements et contexte" },
  { page: "performance", title: "Capital & performance", description: "Rewards, statut et progression" },
  { page: "settings", title: "Réglages", description: "Apparence, suivi, export et connexion" }
];

export function MobileMenu({ navigate }: { navigate: (page: MobilePage) => void }) {
  return <section><h1 className="mb-4 text-xl font-semibold">Toutes les rubriques</h1><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{sections.map(({ page, title, description }) => <button key={page} onClick={() => navigate(page)} className="focus-ring rounded-2xl border border-line bg-panel p-4 text-left"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-muted">{description}</span></button>)}</div></section>;
}
