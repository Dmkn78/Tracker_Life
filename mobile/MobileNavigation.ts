export const MOBILE_REFRESH_EVENT = "life-regime:refresh";
export const MOBILE_LOGOUT_EVENT = "life-regime:logout";

export function navigateMobile(href: string): void {
  if (href === "/login") {
    window.dispatchEvent(new Event(MOBILE_LOGOUT_EVENT));
    href = "/settings";
  }
  window.location.hash = href;
}

const router = {
  push: navigateMobile,
  refresh: () => window.dispatchEvent(new Event(MOBILE_REFRESH_EVENT))
};

// Shared session controls use these two Next router operations.
export function useRouter() { return router; }

/** Query string of the current hash route, e.g. `#/knowledge?note=…`, like Next's useSearchParams. */
export function useSearchParams(): URLSearchParams {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  const queryStart = hash.indexOf("?");
  return new URLSearchParams(queryStart === -1 ? "" : hash.slice(queryStart));
}
