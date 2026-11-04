import type { MetadataRoute } from "next";

/** Installable web app; a long press on the home-screen icon offers the two quick-capture shortcuts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Regime",
    short_name: "Life Regime",
    description: "Ma semaine, mes objectifs et mes notes.",
    start_url: "/",
    display: "standalone",
    background_color: "#11151f",
    theme_color: "#11151f",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }
    ],
    shortcuts: [
      { name: "Nouvelle tâche", short_name: "Tâche", url: "/?capture=task", icons: [{ src: "/icons/shortcut-task.png", sizes: "96x96", type: "image/png" }] },
      { name: "Nouvelle note", short_name: "Note", url: "/knowledge?capture=note", icons: [{ src: "/icons/shortcut-note.png", sizes: "96x96", type: "image/png" }] }
    ]
  };
}
