/** HTTP is limited to local servers or the one explicitly configured personal VPS. */
export function normalizeServerAddress(input: string, personalHttpOrigin?: string): string {
  const url = new URL(input.trim());
  const host = url.hostname;
  const privateHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]"
    || /^10\.\d+\.\d+\.\d+$/.test(host)
    || /^192\.168\.\d+\.\d+$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  const isIpAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)
    || (host.startsWith("[") && host.endsWith("]"));
  const isPersonalHttpServer = isIpAddress && url.protocol === "http:" && url.origin === personalHttpOrigin;
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Utilise uniquement l’adresse du serveur, sans chemin ni identifiants.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (privateHost || isPersonalHttpServer))) {
    throw new Error("Utilise HTTPS, une IP locale ou l’adresse exacte du VPS configuré dans cette APK.");
  }
  return url.origin;
}
