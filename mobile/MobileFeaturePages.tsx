import { useCallback } from "react";
import { WeekBoardView } from "@/features/week/components/WeekBoardView";
import { GoalsView } from "@/features/goals/components/GoalsView";
import { KnowledgeView } from "@/features/knowledge/components/KnowledgeView";
import { InsightsView } from "@/features/insights/components/InsightsView";
import { LifeDashboardContent } from "@/features/life-terminal/components/LifeDashboardContent";
import { LifeTerminalClient } from "@/features/life-terminal/components/LifeTerminalClient";
import { parseLifeTerminalData } from "@/features/life-terminal/api/lifeTerminalApi";
import { DailyLogDatePicker } from "@/features/daily-log/components/DailyLogDatePicker";
import { DailyLogForm } from "@/features/daily-log/components/DailyLogForm";
import { parseDailyLogStatuses } from "@/features/daily-log/api/dailyLogApi";
import { EmotionalReviewClient } from "@/features/emotional/components/EmotionalReviewClient";
import { CalendarPageClient } from "@/features/calendar/components/CalendarPageClient";
import { HabitsClient } from "@/features/habits/components/HabitsClient";
import { loadHabitTracker } from "@/features/habits/api/habitsApi";
import { ThinkingNotesClient } from "@/features/thinking-notes/components/ThinkingNotesClient";
import { TimeAllocationClient } from "@/features/time-allocation/components/TimeAllocationClient";
import { loadTimeAllocation } from "@/features/time-allocation/api/timeAllocationApi";
import { canonicalAllocationAnchor, isTimeAllocationPeriod } from "@/features/time-allocation/domain/allocationPeriod";
import { HistoryContent } from "@/features/history/components/HistoryContent";
import { parseHistoryData } from "@/features/history/api/historyApi";
import { normalizeHistoryFilter } from "@/features/history/domain/history";
import { SettingsClient } from "@/features/settings/components/SettingsClient";
import { parseSettingsResponse } from "@/features/settings/api/settingsApi";
import { WeeklyExportButton } from "@/components/WeeklyExportButton";
import { requestJson } from "@/lib/http/apiClient";
import { addDays, toDateKey } from "@/lib/dates";
import { MobileResource } from "./MobileResource";
import { selectedMobileDate, type MobileRoute } from "./routes";

const loadSettings = (signal: AbortSignal) => requestJson("/api/settings", parseSettingsResponse, { signal });
const loadTerminal = (signal: AbortSignal) => requestJson("/api/life-terminal", parseLifeTerminalData, { signal });

export default function MobileFeaturePages({ route, serverScope }: { route: MobileRoute; serverScope?: string }) {
  const today = toDateKey();
  const date = selectedMobileDate(route.search, today);
  switch (route.page) {
    case "daily-log": return <MobileDailyLog key={date} date={date} serverScope={serverScope} />;
    case "emotional": return <EmotionalReviewClient />;
    case "thinking": return <ThinkingNotesClient today={today} />;
    case "calendar": return <CalendarPageClient today={today} />;
    case "habits": return <MobileHabits key={date} date={date} />;
    case "time-allocation": return <MobileAllocation search={route.search} date={date} />;
    case "history": return <MobileHistory search={route.search} />;
    case "settings": return <MobileResource load={loadSettings}>{settings => <div className="space-y-4"><WeeklyExportButton /><SettingsClient initialCalorieTarget={settings.calorieTarget} initialSleepDelay={settings.defaultSleepDelayMin} usingDevAccessKey={false} interfaceSettings="external" /></div>}</MobileResource>;
    case "home": return <WeekBoardView />;
    case "objectives": return <GoalsView />;
    case "knowledge": return <KnowledgeView />;
    case "insights": return <InsightsView />;
    case "life": return <MobileResource load={loadTerminal}>{data => <LifeDashboardContent data={data} />}</MobileResource>;
    case "life-terminal": return <MobileResource load={loadTerminal}>{data => <LifeTerminalClient data={data} />}</MobileResource>;
    default: return null;
  }
}

function MobileDailyLog({ date, serverScope }: { date: string; serverScope?: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const month = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
    const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const query = new URLSearchParams({ from: addDays(date.slice(0, 7) + "-01", -7), to: addDays(nextMonth, 7) });
    const [settings, statuses] = await Promise.all([loadSettings(signal), requestJson(`/api/daily-log/statuses?${query}`, parseDailyLogStatuses, { signal })]);
    return { settings, statuses };
  }, [date]);
  return <MobileResource load={load}>{({ settings, statuses }) => <><h1 className="mb-4 text-xl font-semibold">Logs quotidiens</h1><DailyLogDatePicker selectedDate={date} statuses={statuses} /><DailyLogForm selectedDate={date} defaultSleepDelayMin={settings.defaultSleepDelayMin} calorieTarget={settings.calorieTarget} draftStorageKey={serverScope ? `life-regime:daily-log:${encodeURIComponent(serverScope)}:${date}` : undefined} /></>}</MobileResource>;
}

function MobileHabits({ date }: { date: string }) {
  const load = useCallback((signal: AbortSignal) => loadHabitTracker(date, signal), [date]);
  return <MobileResource load={load}>{data => <HabitsClient initialData={data} />}</MobileResource>;
}

function MobileAllocation({ search, date }: { search: string; date: string }) {
  const params = new URLSearchParams(search);
  const requestedPeriod = params.get("period");
  const period = isTimeAllocationPeriod(requestedPeriod) ? requestedPeriod : "day";
  const anchor = canonicalAllocationAnchor(period, date);
  const load = useCallback((signal: AbortSignal) => loadTimeAllocation(period, anchor, signal), [period, anchor]);
  return <MobileResource load={load}>{data => <TimeAllocationClient initialData={data} hasExplicitSelection={params.has("date") || params.has("period")} onSelectionChange={(nextPeriod, nextDate) => {
    window.history.replaceState(window.history.state, "", `#/time-allocation?period=${nextPeriod}&date=${nextDate}`);
  }} />}</MobileResource>;
}

function MobileHistory({ search }: { search: string }) {
  const filter = normalizeHistoryFilter(new URLSearchParams(search).get("filter") ?? undefined);
  const load = useCallback((signal: AbortSignal) => requestJson(`/api/history?filter=${filter}`, parseHistoryData, { signal }), [filter]);
  return <MobileResource load={load}>{data => <HistoryContent data={data} />}</MobileResource>;
}
