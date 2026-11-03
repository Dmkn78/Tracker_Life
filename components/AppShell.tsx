"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  FolderKanban,
  Home,
  HeartPulse,
  Lightbulb,
  Menu,
  MonitorCog,
  PieChart,
  TrendingUp,
  Repeat2,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppearanceControl } from "@/features/interface/components/AppearanceControl";
import { LocaleControl } from "@/features/interface/components/LocaleControl";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TranslationKey } from "@/features/interface/localization/messages";

type NavigationItem = { href: string; labelKey: TranslationKey; icon: typeof Home };

/** What the user does every day: plan the week, set goals, keep notes, ask about the history. */
const PRIMARY_NAVIGATION_ITEMS = [
  { href: "/", labelKey: "nav.week", icon: CalendarCheck },
  { href: "/objectives", labelKey: "nav.goals", icon: Target },
  { href: "/knowledge", labelKey: "nav.knowledge", icon: BookOpen },
  { href: "/insights", labelKey: "nav.insights", icon: Sparkles }
] satisfies NavigationItem[];

/** Detailed tools kept available but out of the way. */
const SECONDARY_NAVIGATION_ITEMS = [
  { href: "/daily-log", labelKey: "nav.dailyLog", icon: SlidersHorizontal },
  { href: "/todo", labelKey: "nav.todoAdvanced", icon: CheckSquare },
  { href: "/objectives/planning", labelKey: "nav.objectivesPlanning", icon: FolderKanban },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/habits", labelKey: "nav.habits", icon: Repeat2 },
  { href: "/time-allocation", labelKey: "nav.timeAllocation", icon: PieChart },
  { href: "/emotional", labelKey: "nav.emotional", icon: HeartPulse },
  { href: "/thinking", labelKey: "nav.thinking", icon: Lightbulb },
  { href: "/life-terminal", labelKey: "nav.terminal", icon: MonitorCog },
  { href: "/life", labelKey: "nav.life", icon: Activity },
  { href: "/performance", labelKey: "nav.performance", icon: TrendingUp },
  { href: "/history", labelKey: "nav.history", icon: Clock3 }
] satisfies NavigationItem[];

const SETTINGS_NAVIGATION_ITEM: NavigationItem = { href: "/settings", labelKey: "nav.settings", icon: Settings };
const NAVIGATION_ITEMS: NavigationItem[] = [...PRIMARY_NAVIGATION_ITEMS, ...SECONDARY_NAVIGATION_ITEMS, SETTINGS_NAVIGATION_ITEM];

const SIDEBAR_STORAGE_KEY = "life-regime:sidebar-collapsed";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`focus-ring flex h-11 items-center rounded-2xl px-3 text-sm font-medium transition ${
        collapsed ? "justify-center" : "gap-3"
      } ${
        active
          ? "bg-panel text-ink ring-1 ring-line"
          : "text-muted hover:bg-panel2/60 hover:text-ink"
      }`}
      title={label}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function SecondaryNavigation({
  collapsed,
  pathname,
  onNavigate
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { translate } = useLocale();
  const isCurrentPageSecondary = SECONDARY_NAVIGATION_ITEMS.some((item) => item.href === pathname);
  const [isExpanded, setIsExpanded] = useState(isCurrentPageSecondary);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        title={translate("nav.moreTools")}
        className={`focus-ring flex h-9 items-center rounded-2xl px-3 text-xs font-medium uppercase tracking-wide text-muted transition hover:text-ink ${collapsed ? "justify-center" : "justify-between"}`}
      >
        {!collapsed ? <span>{translate("nav.moreTools")}</span> : null}
        <ChevronDown className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {isExpanded
        ? SECONDARY_NAVIGATION_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={translate(item.labelKey)}
              icon={item.icon}
              collapsed={collapsed}
              active={pathname === item.href}
              onNavigate={onNavigate}
            />
          ))
        : null}
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  onToggle,
  onNavigate,
  mobile = false
}: {
  collapsed: boolean;
  pathname: string;
  onToggle?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const { translate } = useLocale();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex items-start ${collapsed && !mobile ? "justify-center" : "justify-between"} gap-3`}>
        <Link href="/" className="block min-w-0" onClick={onNavigate}>
          <p className={`text-[11px] font-medium uppercase tracking-[0.2em] text-muted ${collapsed && !mobile ? "text-center" : ""}`}>Life Regime</p>
          {!collapsed || mobile ? (
            <h1 className="mt-1 truncate text-xl font-semibold tracking-normal text-ink">
              {translate("shell.tracker")}
            </h1>
          ) : null}
        </Link>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-panel2/60 text-muted ring-1 ring-line transition hover:bg-panel2 hover:text-ink"
            aria-label={translate(
              collapsed
                ? "shell.expandSidebar"
                : mobile
                  ? "shell.closeMenu"
                  : "shell.collapseSidebar"
            )}
          >
            {mobile ? <X className="h-4 w-4" /> : collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      <nav className="thin-scrollbar mt-8 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1">
        {PRIMARY_NAVIGATION_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={translate(item.labelKey)}
            icon={item.icon}
            collapsed={collapsed && !mobile}
            active={pathname === item.href}
            onNavigate={onNavigate}
          />
        ))}
        <SecondaryNavigation collapsed={collapsed && !mobile} pathname={pathname} onNavigate={onNavigate} />
        <NavLink
          href={SETTINGS_NAVIGATION_ITEM.href}
          label={translate(SETTINGS_NAVIGATION_ITEM.labelKey)}
          icon={SETTINGS_NAVIGATION_ITEM.icon}
          collapsed={collapsed && !mobile}
          active={pathname === SETTINGS_NAVIGATION_ITEM.href}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mt-auto grid gap-2">
        {collapsed && !mobile ? (
          <div className="grid gap-2">
            <AppearanceControl compact />
            <LocaleControl compact />
          </div>
        ) : (
          <>
            <AppearanceControl />
            <div className="rounded-[20px] bg-panel2/70 p-3 ring-1 ring-line">
              <LocaleControl />
            </div>
          </>
        )}
        <div className={`rounded-[20px] bg-panel2/70 p-3 ring-1 ring-line ${collapsed && !mobile ? "hidden" : ""}`}>
          <p className="text-xs font-medium uppercase text-muted">{translate("shell.mode")}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{translate("shell.calmOperatingSystem")}</p>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const { translate } = useLocale();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setDesktopCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const desktopPadding = desktopCollapsed ? "md:pl-28" : "md:pl-72";

  return (
    <div className="min-h-screen overflow-x-clip">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden bg-shell/82 px-4 py-6 backdrop-blur-2xl ring-1 ring-inset ring-line transition-[width] duration-200 md:block ${
          desktopCollapsed ? "w-24" : "w-64"
        }`}
      >
        <SidebarContent
          collapsed={desktopCollapsed}
          pathname={pathname}
          onToggle={() => setDesktopCollapsed((current) => !current)}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden">
          <button type="button" className="absolute inset-0" aria-label={translate("shell.closeMenu")} onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86vw] max-w-[320px] bg-shell/96 px-4 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-line">
            <SidebarContent collapsed={false} pathname={pathname} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} mobile />
          </aside>
        </div>
      ) : null}

      <main className={`mx-auto min-h-screen min-w-0 px-4 pb-10 pt-5 sm:px-5 md:pr-8 md:pt-8 ${desktopPadding} ${wide ? "max-w-[1720px]" : "max-w-6xl"}`}>
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-panel2/70 text-ink ring-1 ring-line transition hover:bg-panel2"
            aria-label={translate("shell.openNavigation")}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-sm font-medium text-muted">
            {translate(NAVIGATION_ITEMS.find((item) => item.href === pathname)?.labelKey ?? "nav.week")}
          </p>
        </div>
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
