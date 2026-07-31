"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderKanban,
  Home,
  Menu,
  MonitorCog,
  PieChart,
  Repeat2,
  Settings,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/life-terminal", label: "Terminal", icon: MonitorCog },
  { href: "/life", label: "Life", icon: Activity },
  { href: "/daily-log", label: "Daily Log", icon: SlidersHorizontal },
  { href: "/todo", label: "To-do", icon: CheckSquare },
  { href: "/objectives", label: "Objectives", icon: FolderKanban },
  { href: "/time-allocation", label: "Time Allocation", icon: PieChart },
  { href: "/habits", label: "Habits", icon: Repeat2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/history", label: "History", icon: Clock3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

const storageKey = "life-regime:sidebar-collapsed";

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
          ? "bg-white/[0.09] text-slate-50 ring-1 ring-white/10"
          : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
      }`}
      title={label}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
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
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex items-start ${collapsed && !mobile ? "justify-center" : "justify-between"} gap-3`}>
        <Link href="/" className="block min-w-0" onClick={onNavigate}>
          <p className={`text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 ${collapsed && !mobile ? "text-center" : ""}`}>Life Regime</p>
          {!collapsed || mobile ? <h1 className="mt-1 truncate text-xl font-semibold tracking-normal text-slate-50">Tracker</h1> : null}
        </Link>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-400 ring-1 ring-white/8 transition hover:bg-white/[0.07] hover:text-slate-100"
            aria-label={collapsed ? "Expand sidebar" : mobile ? "Close menu" : "Collapse sidebar"}
          >
            {mobile ? <X className="h-4 w-4" /> : collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      <nav className="mt-8 grid gap-2">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed && !mobile}
            active={pathname === item.href}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className={`mt-auto rounded-[20px] bg-white/[0.045] p-3 ring-1 ring-white/8 ${collapsed && !mobile ? "hidden" : ""}`}>
        <p className="text-xs font-medium uppercase text-slate-500">Mode</p>
        <p className="mt-1 text-sm font-semibold text-slate-200">Calm operating system</p>
      </div>
    </div>
  );
}

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    setDesktopCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const desktopPadding = desktopCollapsed ? "md:pl-28" : "md:pl-72";

  return (
    <div className="min-h-screen overflow-x-clip">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden bg-shell/82 px-4 py-6 backdrop-blur-2xl ring-1 ring-inset ring-white/8 transition-[width] duration-200 md:block ${
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
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm md:hidden">
          <button type="button" className="absolute inset-0" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86vw] max-w-[320px] bg-shell/96 px-4 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/8">
            <SidebarContent collapsed={false} pathname={pathname} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} mobile />
          </aside>
        </div>
      ) : null}

      <main className={`mx-auto min-h-screen min-w-0 px-4 pb-10 pt-5 sm:px-5 md:pr-8 md:pt-8 ${desktopPadding} ${wide ? "max-w-[1720px]" : "max-w-6xl"}`}>
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-200 ring-1 ring-white/8 transition hover:bg-white/[0.08]"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-sm font-medium text-slate-400">{nav.find((item) => item.href === pathname)?.label ?? "Life Regime"}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
