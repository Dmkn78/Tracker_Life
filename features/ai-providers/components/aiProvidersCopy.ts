export const AI_PROVIDERS_COPY = {
  fr: {
    eyebrow: "Intelligence artificielle", title: "Modèles d'IA",
    description: "Facultatif : l'application fonctionne sans IA. Un modèle sert à analyser ton historique, proposer des étapes et préparer des tâches.",
    empty: "Aucun modèle configuré.", add: "Ajouter un modèle", cancel: "Annuler",
    chooseProvider: "Fournisseur", apiKey: "Clé API", apiKeyOptional: "Clé API (facultative)", apiKeyPlaceholder: "Collée ici, chiffrée sur le serveur",
    baseUrl: "Adresse du serveur", advanced: "Adresse personnalisée",
    localHint: "Les appels partent du serveur de l'application : 127.0.0.1 désigne cette machine. Pour joindre ton PC depuis un VPS, utilise son IP LAN ou Tailscale.",
    customHint: "Serveur compatible OpenAI (vLLM, llama.cpp, LocalAI…). https:// obligatoire hors réseau local.",
    test: "Tester la connexion", testing: "Connexion…", connected: "Connecté en {ms} ms · {count} modèles", noModels: "Connexion réussie mais aucun modèle n'est disponible.",
    model: "Modèle", modelPlaceholder: "Identifiant du modèle", save: "Enregistrer", saving: "Enregistrement…",
    makeDefault: "Utiliser par défaut", isDefault: "Par défaut", local: "Local", cloud: "Cloud", remove: "Supprimer",
    noModel: "aucun modèle choisi", retest: "Tester", confirmRemove: "Supprimer ce modèle d'IA ?", failed: "L'opération a échoué."
  },
  en: {
    eyebrow: "Artificial intelligence", title: "AI models",
    description: "Optional: the app works without AI. A model is used to analyse your history, suggest steps and draft tasks.",
    empty: "No model configured.", add: "Add a model", cancel: "Cancel",
    chooseProvider: "Provider", apiKey: "API key", apiKeyOptional: "API key (optional)", apiKeyPlaceholder: "Pasted here, encrypted on the server",
    baseUrl: "Server address", advanced: "Custom address",
    localHint: "Calls are made by the app server: 127.0.0.1 means that machine. To reach your PC from a VPS, use its LAN or Tailscale IP.",
    customHint: "OpenAI-compatible server (vLLM, llama.cpp, LocalAI…). https:// required outside your local network.",
    test: "Test connection", testing: "Connecting…", connected: "Connected in {ms} ms · {count} models", noModels: "Connected, but no model is available.",
    model: "Model", modelPlaceholder: "Model identifier", save: "Save", saving: "Saving…",
    makeDefault: "Use by default", isDefault: "Default", local: "Local", cloud: "Cloud", remove: "Remove",
    noModel: "no model selected", retest: "Test", confirmRemove: "Remove this AI model?", failed: "The operation failed."
  }
};

export type AiProvidersCopy = (typeof AI_PROVIDERS_COPY)["fr"];
