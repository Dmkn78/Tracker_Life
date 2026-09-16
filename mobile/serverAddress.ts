/** HTTP is supported only for a local development server; remote connections use HTTPS. */
export function normalizeServerAddress(input: string): string {
  const url = new URL(input.trim());
  const host = url.hostname;
  const privateHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]"
    || /^10\.\d+\.\d+\.\d+$/.test(host)
    || /^192\.168\.\d+\.\d+$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Utilise uniquement l’adresse du serveur, sans chemin ni identifiants.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && privateHost)) {
    throw new Error("Utilise HTTPS, ou une adresse IP locale pour ton serveur personnel.");
  }
  return url.origin;
}
