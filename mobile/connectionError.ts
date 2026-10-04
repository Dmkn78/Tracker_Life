export type ConnectionStage = "address" | "login" | "session" | "capture";

export function describeConnectionError(cause: unknown, stage: ConnectionStage): string {
  const error = cause && typeof cause === "object" ? cause as { message?: unknown; status?: unknown; name?: unknown } : {};
  const message = typeof error.message === "string" ? error.message : typeof cause === "string" ? cause : "";
  if (error.status === 401 || error.status === 403) {
    return stage === "session"
      ? "La clé a été acceptée, mais la session n’est pas conservée. Si le serveur impose un cookie Secure, connecte-toi à son adresse HTTPS."
      : "Le serveur a refusé la clé d’accès. Vérifie la clé utilisée pour ce serveur.";
  }
  if (error.status === 404) return "Serveur joignable, mais API introuvable. Vérifie le port et l’adresse du site ou de l’API Life Regime.";
  if (error.name === "AbortError" || /timeout|timed out/i.test(message)) return "Le serveur ne répond pas dans le délai prévu. Vérifie le port, le pare-feu du VPS et son accès depuis le téléphone.";
  if (/ssl|certificate|certpath|handshake/i.test(message)) return "La connexion HTTPS a échoué : le certificat doit être valide et correspondre à l’adresse saisie.";
  if (/unable to resolve host|unknownhost|failed to connect|connection refused|networkerror|failed to fetch/i.test(message)) return "Serveur inaccessible. Vérifie l’adresse complète, le port et l’accès depuis le navigateur du téléphone.";
  if (/invalid JSON|invalid response/i.test(message)) return "Le serveur répond, mais pas avec l’API Life Regime attendue. Vérifie son adresse et son port.";
  return message || "Impossible de joindre le serveur. Vérifie l’adresse complète et le port.";
}
