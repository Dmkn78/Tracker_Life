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
