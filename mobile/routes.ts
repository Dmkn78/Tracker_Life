export const MOBILE_PAGES = ["home", "knowledge", "insights", "todo", "funnel", "daily-log", "objectives", "objectives-planning", "performance", "life-terminal", "life", "emotional", "habits", "thinking", "time-allocation", "calendar", "history", "settings", "more"] as const;
export type MobilePage = typeof MOBILE_PAGES[number];
export type MobileRoute = { page: MobilePage; search: string };

export function parseMobileRoute(href: string): MobileRoute | null {
  const path = href.startsWith("#") ? href.slice(1) : href;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const url = new URL(path, "https://mobile.invalid");
  const slug = url.pathname.replace(/^\/|\/$/g, "");
  const page = slug === "" ? "home" : slug === "dashboard" || slug === "dashboard/life-terminal" ? "life-terminal" : slug.replaceAll("/", "-");
  return MOBILE_PAGES.includes(page as MobilePage) ? { page: page as MobilePage, search: url.search } : null;
}

export function mobileRouteHref(page: MobilePage): string {
  if (page === "home") return "/";
  return page === "objectives-planning" ? "/objectives/planning" : `/${page}`;
}

export function selectedMobileDate(search: string, today: string): string {
  const date = new URLSearchParams(search).get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return today;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : today;
}
