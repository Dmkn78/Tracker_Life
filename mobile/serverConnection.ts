import { normalizeServerAddress } from "./serverAddress";

export function normalizeConfiguredServerAddress(input: string): string {
  const origin = normalizeServerAddress(input, import.meta.env.VITE_PERSONAL_HTTP_ORIGIN);
  return origin;
}
