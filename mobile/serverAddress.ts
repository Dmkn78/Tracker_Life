export type ServerTransportPolicy = "https-or-local" | "allow-http";

/** Public HTTP requires an explicit choice for the configured server. */
export function normalizeServerAddress(input: string, policy: ServerTransportPolicy = "https-or-local"): string {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new Error("Adresse invalide. Indique http:// ou https:// devant l’IP ou le domaine, avec le port si nécessaire."); }
  const host = url.hostname;
  const privateHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]"
    || /^10\.\d+\.\d+\.\d+$/.test(host)
    || /^192\.168\.\d+\.\d+$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Utilise uniquement l’adresse du serveur, sans chemin ni identifiants.");
  }
  if (url.protocol === "http:" && !privateHost && policy !== "allow-http") {
    throw new Error("Ce serveur utilise HTTP. Coche « Autoriser HTTP pour ce serveur » ou utilise son adresse HTTPS.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("L’adresse doit commencer par http:// ou https://.");
  return url.origin;
}
