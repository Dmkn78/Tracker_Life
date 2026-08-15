"use client";

import { Clock3, PencilLine, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DurationInput, formatDuration } from "@/components/DurationInput";
import {
  Drawer,
  FieldLabel,
  GhostButton,
  Metric,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  Segmented,
  SegmentedButton,
  SoftPanel,
  TextArea,
  TextInput
} from "@/components/ui";
import {
  createHabit,
  deleteHabitTemplate,
  deleteHabit,
  loadHabitTracker,
  saveHabitCheckin,
  updateHabit
} from "@/features/habits/api/habitsApi";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type {
  Habit,
  HabitCheckinPatch,
  HabitDraft,
  HabitTemplate,
  HabitTrackerData
} from "@/features/habits/domain/habit";
import { ApiError } from "@/lib/http/apiClient";
import { ISO_WEEKDAYS, normalizeRecurrenceDays, type IsoWeekday } from "@/features/habits/domain/habitSchedule";

const WEEKDAY_KEYS: Record<IsoWeekday, keyof HabitCopy> = {
  1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday",
  5: "friday", 6: "saturday", 7: "sunday"
};

const STARTER_TEMPLATES: HabitTemplate[] = [
  { id: "starter-morning", name: "Morning routine", category: "routine", description: "Start the day deliberately.", targetTime: "07:00", defaultExpectedMinutes: 45, recurrenceDays: [1, 2, 3, 4, 5], timeBlockEnabled: true },
  { id: "starter-move", name: "Move", category: "health", description: "Walk, train or stretch.", targetTime: "18:00", defaultExpectedMinutes: 30, recurrenceDays: [1, 2, 3, 4, 5, 6, 7], timeBlockEnabled: true },
  { id: "starter-review", name: "Weekly review", category: "reflection", description: "Review the week and prepare the next one.", targetTime: "18:00", defaultExpectedMinutes: 45, recurrenceDays: [7], timeBlockEnabled: true }
];

export function HabitsClient({ initialData }: { initialData: HabitTrackerData }) {
  const { locale } = useLocale();
  const copy = HABIT_COPY[locale];
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.date);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; draft: HabitDraft } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const loadControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const mutationInFlightRef = useRef(false);
  const dateRef = useRef(initialData.date);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const plannedMinutes = useMemo(() => data.habits.reduce((sum, habit) => sum + habit.defaultExpectedMinutes, 0), [data.habits]);
  const actualMinutes = useMemo(() => data.habits.reduce((sum, habit) => sum + habit.checkin.actualMinutes, 0), [data.habits]);
  const timelineItems = useMemo(() => {
    if (data.routineBlocks.length > 0) {
      return data.routineBlocks.map((block) => {
        const habit = data.habits.find((item) => item.id === block.habitId);
        return {
          id: block.id,
          label: block.label,
          detail: habit?.name ?? copy.noLinkedHabit,
          startTime: block.startTime,
          endTime: block.endTime
        };
      });
    }
    return [...data.habits]
      .filter((habit) => habit.targetTime)
      .sort((a, b) => String(a.targetTime).localeCompare(String(b.targetTime)))
      .map((habit) => ({
        id: habit.id,
        label: habit.name,
        detail: habit.description || habit.category,
        startTime: habit.targetTime ?? "--:--",
        endTime: formatEndTime(habit.targetTime, habit.defaultExpectedMinutes)
      }));
  }, [copy.noLinkedHabit, data.habits, data.routineBlocks]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      loadControllerRef.current?.abort();
    };
  }, []);

  async function load(nextDate = date) {
    loadControllerRef.current?.abort();
    const requestController = new AbortController();
    loadControllerRef.current = requestController;
    setSaving(true);
    setPageError(null);
    try {
      const tracker = await loadHabitTracker(nextDate, requestController.signal);
      if (mountedRef.current && dateRef.current === nextDate) setData(tracker);
    } catch (error: unknown) {
      if (!requestController.signal.aborted && mountedRef.current && dateRef.current === nextDate) {
        setPageError(readApiErrorMessage(error, copy.loadError));
      }
    } finally {
      if (mountedRef.current && loadControllerRef.current === requestController) {
        loadControllerRef.current = null;
        setSaving(false);
      }
    }
  }

  async function saveCheckin(habit: Habit, patch: HabitCheckinPatch) {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    const mutationDate = dateRef.current;
    cancelPendingLoad();
    setSaving(true);
    setPageError(null);
    try {
      const tracker = await saveHabitCheckin({
        habitId: habit.id,
        date: mutationDate,
        status: patch.status ?? habit.checkin.status,
        actualMinutes: patch.actualMinutes ?? habit.checkin.actualMinutes,
        note: patch.note ?? habit.checkin.note
      });
      if (mountedRef.current && dateRef.current === mutationDate) setData(tracker);
    } catch (error: unknown) {
      if (mountedRef.current && dateRef.current === mutationDate) setPageError(readApiErrorMessage(error, copy.checkinError));
    } finally {
      mutationInFlightRef.current = false;
      if (mountedRef.current && dateRef.current === mutationDate) setSaving(false);
    }
  }

  function openCreate() {
    setDrawerError(null);
    setDrawer({
      mode: "create",
      draft: {
        name: "",
        category: "routine",
        description: "",
        targetTime: "07:00",
        defaultExpectedMinutes: 30,
        recurrenceDays: [...ISO_WEEKDAYS],
        timeBlockEnabled: true
      }
    });
    setSaveAsTemplate(false);
  }

  function openEdit(habit: Habit) {
    setDrawerError(null);
    setDrawer({
      mode: "edit",
      draft: {
        id: habit.id,
        name: habit.name,
        category: habit.category,
        description: habit.description ?? "",
        targetTime: habit.targetTime ?? "",
        defaultExpectedMinutes: habit.defaultExpectedMinutes,
        recurrenceDays: [...habit.recurrenceDays],
        timeBlockEnabled: habit.timeBlockEnabled
      }
    });
    setSaveAsTemplate(false);
  }

  function applyTemplate(template: HabitTemplate): void {
    const localizedTemplate = localizeStarterTemplate(template, locale);
    setDrawer((current) => current ? {
      ...current,
      draft: {
        ...current.draft,
        name: localizedTemplate.name,
        category: localizedTemplate.category,
        description: localizedTemplate.description ?? "",
        targetTime: template.targetTime ?? "",
        defaultExpectedMinutes: template.defaultExpectedMinutes,
        recurrenceDays: normalizeRecurrenceDays(template.recurrenceDays),
        timeBlockEnabled: template.timeBlockEnabled
      }
    } : current);
  }

  async function saveHabit(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || !drawer.draft.name.trim()) return;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    cancelPendingLoad();
    const mutationDate = dateRef.current;
    const draft = { ...drawer.draft, recurrenceDays: [...drawer.draft.recurrenceDays] };
    setSaving(true);
    setDrawerError(null);
    try {
      const habitId = drawer.mode === "edit" ? draft.id : undefined;
      if (habitId) await updateHabit({ ...draft, id: habitId });
      else await createHabit(draft, saveAsTemplate);
      const tracker = await loadHabitTracker(mutationDate);
      if (mountedRef.current && dateRef.current === mutationDate) {
        setData(tracker);
        setDrawer(null);
      }
    } catch (error: unknown) {
      if (mountedRef.current && dateRef.current === mutationDate) setDrawerError(readApiErrorMessage(error, copy.saveError));
    } finally {
      mutationInFlightRef.current = false;
      if (mountedRef.current && dateRef.current === mutationDate) setSaving(false);
    }
  }

  async function deleteSelectedHabit() {
    if (!drawer?.draft.id) return;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    cancelPendingLoad();
    const mutationDate = dateRef.current;
    setSaving(true);
    setDrawerError(null);
    try {
      const tracker = await deleteHabit(drawer.draft.id, mutationDate);
      if (mountedRef.current && dateRef.current === mutationDate) {
        setData(tracker);
        setDrawer(null);
      }
    } catch (error: unknown) {
      if (mountedRef.current && dateRef.current === mutationDate) setDrawerError(readApiErrorMessage(error, copy.deleteError));
    } finally {
      mutationInFlightRef.current = false;
      if (mountedRef.current && dateRef.current === mutationDate) setSaving(false);
    }
  }

  async function removeTemplate(templateId: string): Promise<void> {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    try {
      await deleteHabitTemplate(templateId);
      if (mountedRef.current) {
        setData((current) => ({ ...current, templates: current.templates.filter((template) => template.id !== templateId) }));
      }
    } catch (error: unknown) {
      if (mountedRef.current) setDrawerError(readApiErrorMessage(error, copy.templateDeleteError));
    } finally {
      mutationInFlightRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  function cancelPendingLoad() {
    loadControllerRef.current?.abort();
    loadControllerRef.current = null;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        detail={copy.detail}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => load()} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              {copy.refresh}
            </SecondaryButton>
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {copy.addHabit}
            </PrimaryButton>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <TextInput
          disabled={saving}
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            dateRef.current = nextDate;
            setDate(nextDate);
            load(nextDate);
          }}
          className="w-auto min-w-[170px]"
        />
        <Pill>{saving ? copy.syncing : copy.live}</Pill>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={copy.doneToday} value={`${data.metrics.completedToday}/${data.metrics.totalToday}`} tone={data.metrics.completionRateToday >= 70 ? "good" : "neutral"} />
        <Metric label={copy.completion} value={`${data.metrics.completionRateToday}%`} />
        <Metric label={copy.plannedTime} value={formatDuration(plannedMinutes)} />
        <Metric label={copy.actualTime} value={formatDuration(actualMinutes)} />
      </div>

      {pageError ? (
        <p role="alert" className="rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk">
          {pageError}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <SoftPanel className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">{copy.habitsFor} {date}</h2>
            <span className="text-sm text-muted">{data.habits.length}</span>
          </div>
          {data.habits.length === 0 ? (
            <EmptyState text={copy.empty} />
          ) : (
            <div className="space-y-2">
              {data.habits.map((habit) => (
                <div key={habit.id} className="rounded-[20px] bg-panel2/50 px-4 py-3 ring-1 ring-line/70">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => openEdit(habit)} className="w-full text-left">
                        <p className="whitespace-normal break-words text-base font-semibold text-ink">{habit.name}</p>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill>{habit.category}</Pill>
                        {habit.targetTime ? <Pill>{habit.targetTime}</Pill> : null}
                        <Pill>{formatDuration(habit.defaultExpectedMinutes)}</Pill>
                        <Pill className={statusTone(habit.checkin.status)}>{statusLabel(habit.checkin.status, copy)}</Pill>
                        <Pill>{formatRecurrence(habit.recurrenceDays, copy)}</Pill>
                        {habit.timeBlockEnabled ? <Pill>{copy.timeBlocked}</Pill> : null}
                      </div>
                      {habit.description ? <p className="mt-2 text-sm text-muted">{habit.description}</p> : null}
                    </div>
                    <GhostButton disabled={saving} onClick={() => openEdit(habit)} className="min-h-9 rounded-2xl bg-panel2/50 px-3 ring-1 ring-line">
                      <PencilLine className="h-4 w-4" />
                      {copy.edit}
                    </GhostButton>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Segmented className="w-full lg:w-auto">
                      {([
                        { key: "done", label: copy.done },
                        { key: "planned", label: copy.plan },
                        { key: "skipped", label: copy.skip }
                      ] as const).map((option) => (
                        <SegmentedButton
                          disabled={saving}
                          key={option.key}
                          active={habit.checkin.status === option.key}
                          onClick={() =>
                            saveCheckin(habit, {
                              status: option.key,
                              actualMinutes: option.key === "done" ? habit.checkin.actualMinutes || habit.defaultExpectedMinutes : habit.checkin.actualMinutes
                            })
                          }
                          className="flex-1 lg:flex-none"
                        >
                          {option.label}
                        </SegmentedButton>
                      ))}
                    </Segmented>
                    <div className="w-full lg:w-[210px]">
                      <DurationInput
                        label={copy.actualDuration}
                        value={habit.checkin.actualMinutes}
                        onChange={(actualMinutes) => saveCheckin(habit, { actualMinutes })}
                        showStored={false}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SoftPanel>

        <div className="space-y-4">
          <SoftPanel className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted" />
              <h2 className="text-lg font-semibold text-ink">{copy.dayRhythm}</h2>
            </div>
            {timelineItems.length === 0 ? (
              <EmptyState text={copy.noRhythm} />
            ) : (
              <div className="space-y-2">
                {timelineItems.map((item) => (
                  <div key={item.id} className="rounded-[18px] bg-panel2/50 px-4 py-3 ring-1 ring-line/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{item.label}</p>
                        <p className="mt-1 text-sm text-muted">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-sm text-muted">{item.startTime} - {item.endTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SoftPanel>

          <SoftPanel className="p-5">
            <h2 className="text-lg font-semibold text-ink">{copy.categorySnapshot}</h2>
            <div className="mt-4 space-y-2">
              {buildCategorySummary(data.habits).length === 0 ? (
                <p className="text-sm text-muted">{copy.noCategories}</p>
              ) : (
                buildCategorySummary(data.habits).map((item) => (
                  <div key={item.category} className="flex items-center justify-between rounded-[16px] bg-panel2/50 px-3 py-2 text-sm ring-1 ring-line/70">
                    <span className="text-muted">{item.category}</span>
                    <span className="text-ink">{item.done}/{item.total}</span>
                  </div>
                ))
              )}
            </div>
          </SoftPanel>
        </div>
      </div>

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? copy.editHabit : copy.addHabit}
        description={copy.drawerDetail}
        onClose={() => { if (!saving) setDrawer(null); }}
        width="md"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {drawer?.mode === "edit" ? (
                <SecondaryButton disabled={saving} onClick={deleteSelectedHabit} className="text-risk">
                  <Trash2 className="h-4 w-4" />
                  {copy.delete}
                </SecondaryButton>
              ) : null}
            </div>
            <div className="flex gap-2">
              <SecondaryButton disabled={saving} onClick={() => setDrawer(null)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton form="habit-editor-form" type="submit" disabled={!drawer?.draft.name.trim() || saving}>
                {saving ? copy.saving : drawer?.mode === "edit" ? copy.saveHabit : copy.createHabit}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        {drawer ? (
          <form id="habit-editor-form" onSubmit={saveHabit} className="space-y-4">
            {drawerError ? (
              <p role="alert" className="rounded-xl bg-risk/10 px-3 py-2 text-sm text-risk">
                {drawerError}
              </p>
            ) : null}
            <fieldset disabled={saving} className="space-y-4">
            <SoftPanel className="p-4">
              <FieldLabel>{copy.templates}</FieldLabel>
              <p className="mt-1 text-sm text-muted">{copy.templatesDetail}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[...STARTER_TEMPLATES, ...data.templates].map((template) => (
                  <div key={template.id} className="flex min-w-0 items-center gap-2 rounded-2xl bg-panel2/60 p-2 ring-1 ring-line">
                    <button type="button" onClick={() => applyTemplate(template)} className="min-w-0 flex-1 text-left">
                      <span className="block whitespace-normal break-words text-sm font-semibold text-ink">{translateStarterName(template, locale)}</span>
                      <span className="mt-1 block text-xs text-muted">{formatRecurrence(template.recurrenceDays, copy)}</span>
                    </button>
                    {!template.id.startsWith("starter-") ? (
                      <GhostButton type="button" aria-label={copy.deleteTemplate} onClick={() => void removeTemplate(template.id)} className="min-h-9 min-w-9 px-2 text-risk">
                        <Trash2 className="h-4 w-4" />
                      </GhostButton>
                    ) : null}
                  </div>
                ))}
              </div>
            </SoftPanel>
            <div>
              <FieldLabel>{copy.name}</FieldLabel>
              <TextInput
                value={drawer.draft.name}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, name: event.target.value } } : current)}
                className="mt-2"
                placeholder={copy.namePlaceholder}
              />
            </div>
            <div>
              <FieldLabel>{copy.description}</FieldLabel>
              <TextArea
                value={drawer.draft.description}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, description: event.target.value } } : current)}
                className="mt-2 min-h-24"
                placeholder={copy.descriptionPlaceholder}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>{copy.category}</FieldLabel>
                <TextInput
                  value={drawer.draft.category}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, category: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>{copy.targetTime}</FieldLabel>
                <TextInput
                  type="time"
                  value={drawer.draft.targetTime}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, targetTime: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
            </div>
            <DurationInput
              label={copy.expectedDuration}
              value={drawer.draft.defaultExpectedMinutes}
              onChange={(defaultExpectedMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, defaultExpectedMinutes } } : current)}
              showStored={false}
            />
            <div>
              <FieldLabel>{copy.days}</FieldLabel>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label={copy.days}>
                {ISO_WEEKDAYS.map((day) => {
                  const active = drawer.draft.recurrenceDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDrawer((current) => current ? {
                        ...current,
                        draft: {
                          ...current.draft,
                          recurrenceDays: toggleRecurrenceDay(current.draft.recurrenceDays, day)
                        }
                      } : current)}
                      className={`focus-ring min-h-11 rounded-xl px-2 text-sm font-semibold ring-1 ${active ? "bg-accent text-onaccent ring-accent" : "bg-panel2 text-muted ring-line"}`}
                    >
                      {copy[WEEKDAY_KEYS[day]]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <GhostButton type="button" onClick={() => setDrawer((current) => current ? { ...current, draft: { ...current.draft, recurrenceDays: [1, 2, 3, 4, 5] } } : current)}>{copy.weekdays}</GhostButton>
                <GhostButton type="button" onClick={() => setDrawer((current) => current ? { ...current, draft: { ...current.draft, recurrenceDays: [...ISO_WEEKDAYS] } } : current)}>{copy.everyDay}</GhostButton>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-panel2/60 px-4 py-3 text-sm text-ink ring-1 ring-line">
              <input
                type="checkbox"
                checked={drawer.draft.timeBlockEnabled}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, timeBlockEnabled: event.target.checked } } : current)}
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span><span className="block font-semibold">{copy.timeBlock}</span><span className="mt-1 block text-muted">{copy.timeBlockDetail}</span></span>
            </label>
            {drawer.mode === "create" ? <label className="flex items-center gap-3 rounded-2xl bg-panel2/60 px-4 py-3 text-sm text-ink ring-1 ring-line">
              <input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} className="h-4 w-4 accent-accent" />
              {copy.saveTemplate}
            </label> : null}
            </fieldset>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function buildCategorySummary(habits: HabitTrackerData["habits"]) {
  const map = new Map<string, { done: number; total: number }>();
  for (const habit of habits) {
    const current = map.get(habit.category) ?? { done: 0, total: 0 };
    current.total += 1;
    if (habit.checkin.status === "done") current.done += 1;
    map.set(habit.category, current);
  }
  return [...map.entries()].map(([category, value]) => ({ category, ...value }));
}

function formatEndTime(targetTime?: string | null, minutes = 0) {
  if (!targetTime) return "--:--";
  const [hoursValue, minutesValue] = targetTime.split(":").map(Number);
  if (!Number.isFinite(hoursValue) || !Number.isFinite(minutesValue)) return "--:--";
  const total = hoursValue * 60 + minutesValue + minutes;
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function statusTone(status: string) {
  if (status === "done") return "bg-good/10 text-good ring-good/15";
  if (status === "skipped") return "bg-risk/10 text-risk ring-risk/15";
  return "bg-panel2/60 text-muted ring-line";
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[22px] bg-panel2/50 px-4 py-12 text-center text-sm text-muted ring-1 ring-line/70">{text}</div>;
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function toggleRecurrenceDay(days: number[], day: IsoWeekday): number[] {
  if (days.includes(day)) {
    return days.length === 1 ? days : days.filter((candidate) => candidate !== day);
  }
  return normalizeRecurrenceDays([...days, day]);
}

function formatRecurrence(days: number[], copy: HabitCopy): string {
  const normalized = normalizeRecurrenceDays(days);
  if (normalized.length === 7) return copy.everyDay;
  if (normalized.join(",") === "1,2,3,4,5") return copy.weekdays;
  return normalized.map((day) => copy[WEEKDAY_KEYS[day]].slice(0, 3)).join(" · ");
}

function statusLabel(status: string, copy: HabitCopy): string {
  if (status === "done") return copy.done;
  if (status === "skipped") return copy.skip;
  return copy.plan;
}

function translateStarterName(template: HabitTemplate, locale: "en" | "fr"): string {
  return localizeStarterTemplate(template, locale).name;
}

function localizeStarterTemplate(template: HabitTemplate, locale: "en" | "fr"): HabitTemplate {
  const translations: Record<string, Record<"en" | "fr", Pick<HabitTemplate, "name" | "description">>> = {
    "starter-morning": {
      en: { name: "Morning routine", description: "Start the day deliberately." },
      fr: { name: "Routine du matin", description: "Commencer la journée avec intention." }
    },
    "starter-move": {
      en: { name: "Move", description: "Walk, train or stretch." },
      fr: { name: "Bouger", description: "Marcher, s'entraîner ou s'étirer." }
    },
    "starter-review": {
      en: { name: "Weekly review", description: "Review the week and prepare the next one." },
      fr: { name: "Revue hebdomadaire", description: "Relire la semaine et préparer la suivante." }
    }
  };
  const translation = translations[template.id]?.[locale];
  return translation ? { ...template, ...translation } : template;
}

const EN_HABIT_COPY = {
  eyebrow: "Habits",
  title: "Habits & routines",
  detail: "Show only what is scheduled for the selected day, then record what actually happened.",
  refresh: "Refresh",
  addHabit: "Add habit",
  syncing: "Syncing",
  live: "Live",
  doneToday: "Done today",
  completion: "Completion",
  plannedTime: "Planned time",
  actualTime: "Actual time",
  habitsFor: "Habits for",
  empty: "No habit is scheduled for this day.",
  timeBlocked: "calendar block",
  edit: "Edit",
  done: "Done",
  plan: "Plan",
  skip: "Skip",
  actualDuration: "Actual duration",
  dayRhythm: "Day rhythm",
  noRhythm: "No time block is scheduled for this day.",
  categorySnapshot: "Category snapshot",
  noCategories: "Categories appear once a habit is scheduled.",
  editHabit: "Edit habit",
  drawerDetail: "Choose the recurring days and optionally reserve the time in Calendar.",
  delete: "Delete",
  cancel: "Cancel",
  saving: "Saving...",
  saveHabit: "Save habit",
  createHabit: "Create habit",
  templates: "Templates",
  templatesDetail: "Start from a built-in template or one you saved.",
  deleteTemplate: "Delete personal template",
  name: "Name",
  namePlaceholder: "Wake up, review notes, workout...",
  description: "Description",
  descriptionPlaceholder: "Why this habit matters.",
  category: "Category",
  targetTime: "Target time",
  expectedDuration: "Expected duration",
  days: "Recurring days",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
  weekdays: "Monday–Friday",
  everyDay: "Every day",
  timeBlock: "Show as a routine block in Calendar",
  timeBlockDetail: "Uses the target time and expected duration on each selected day.",
  saveTemplate: "Save these settings as a personal template",
  noLinkedHabit: "No linked habit",
  loadError: "Unable to load habits.",
  checkinError: "Unable to save the habit check-in.",
  saveError: "Unable to save the habit.",
  deleteError: "Unable to delete the habit.",
  templateDeleteError: "Unable to delete the template."
} as const;

type HabitCopy = Record<keyof typeof EN_HABIT_COPY, string>;

const HABIT_COPY: Record<"en" | "fr", HabitCopy> = {
  en: EN_HABIT_COPY,
  fr: {
    eyebrow: "Habitudes",
    title: "Habitudes et routines",
    detail: "Affichez uniquement ce qui est prévu pour le jour choisi, puis notez ce qui s'est réellement passé.",
    refresh: "Actualiser",
    addHabit: "Ajouter une habitude",
    syncing: "Synchronisation",
    live: "À jour",
    doneToday: "Faites aujourd'hui",
    completion: "Réalisation",
    plannedTime: "Temps prévu",
    actualTime: "Temps réel",
    habitsFor: "Habitudes du",
    empty: "Aucune habitude n'est prévue ce jour.",
    timeBlocked: "bloc calendrier",
    edit: "Modifier",
    done: "Fait",
    plan: "Prévu",
    skip: "Passé",
    actualDuration: "Durée réelle",
    dayRhythm: "Rythme du jour",
    noRhythm: "Aucun bloc de routine n'est prévu ce jour.",
    categorySnapshot: "Synthèse par catégorie",
    noCategories: "Les catégories apparaissent lorsqu'une habitude est planifiée.",
    editHabit: "Modifier l'habitude",
    drawerDetail: "Choisissez les jours récurrents et réservez éventuellement ce temps dans le calendrier.",
    delete: "Supprimer",
    cancel: "Annuler",
    saving: "Enregistrement...",
    saveHabit: "Enregistrer",
    createHabit: "Créer l'habitude",
    templates: "Modèles",
    templatesDetail: "Partez d'un modèle intégré ou d'un modèle personnel.",
    deleteTemplate: "Supprimer le modèle personnel",
    name: "Nom",
    namePlaceholder: "Se lever, réviser, s'entraîner...",
    description: "Description",
    descriptionPlaceholder: "Pourquoi cette habitude compte.",
    category: "Catégorie",
    targetTime: "Heure cible",
    expectedDuration: "Durée prévue",
    days: "Jours récurrents",
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mer",
    thursday: "Jeu",
    friday: "Ven",
    saturday: "Sam",
    sunday: "Dim",
    weekdays: "Lundi–vendredi",
    everyDay: "Tous les jours",
    timeBlock: "Afficher comme bloc de routine dans le calendrier",
    timeBlockDetail: "Utilise l'heure cible et la durée prévue pour chaque jour sélectionné.",
    saveTemplate: "Enregistrer ces réglages comme modèle personnel",
    noLinkedHabit: "Aucune habitude liée",
    loadError: "Impossible de charger les habitudes.",
    checkinError: "Impossible d'enregistrer le suivi.",
    saveError: "Impossible d'enregistrer l'habitude.",
    deleteError: "Impossible de supprimer l'habitude.",
    templateDeleteError: "Impossible de supprimer le modèle."
  }
};
