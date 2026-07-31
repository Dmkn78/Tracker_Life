"use client";

import { Clock3, PencilLine, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import type { getHabitTrackerData } from "@/lib/habits";

type HabitData = Awaited<ReturnType<typeof getHabitTrackerData>>;
type HabitRow = HabitData["habits"][number];
type HabitStatus = "planned" | "done" | "skipped";

type HabitDraft = {
  id?: string;
  name: string;
  category: string;
  description: string;
  targetTime: string;
  defaultExpectedMinutes: number;
};

export function HabitsClient({ initialData }: { initialData: HabitData }) {
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.date);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; draft: HabitDraft } | null>(null);

  const plannedMinutes = useMemo(() => data.habits.reduce((sum, habit) => sum + habit.defaultExpectedMinutes, 0), [data.habits]);
  const actualMinutes = useMemo(() => data.habits.reduce((sum, habit) => sum + habit.checkin.actualMinutes, 0), [data.habits]);
  const timelineItems = useMemo(() => {
    if (data.routineBlocks.length > 0) {
      return data.routineBlocks.map((block) => {
        const habit = data.habits.find((item) => item.id === block.habitId);
        return {
          id: block.id,
          label: block.label,
          detail: habit?.name ?? "No linked habit",
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
  }, [data.habits, data.routineBlocks]);

  async function load(nextDate = date) {
    setSaving(true);
    const response = await fetch(`/api/habits?date=${nextDate}`);
    setData(await response.json());
    setSaving(false);
  }

  async function saveCheckin(habit: HabitRow, patch: { status?: HabitStatus; actualMinutes?: number; note?: string }) {
    setSaving(true);
    const response = await fetch("/api/habits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "checkin",
        habitId: habit.id,
        date,
        status: patch.status ?? habit.checkin.status,
        actualMinutes: patch.actualMinutes ?? habit.checkin.actualMinutes,
        note: patch.note ?? habit.checkin.note
      })
    });
    setData(await response.json());
    setSaving(false);
  }

  function openCreate() {
    setDrawer({
      mode: "create",
      draft: {
        name: "",
        category: "routine",
        description: "",
        targetTime: "07:00",
        defaultExpectedMinutes: 30
      }
    });
  }

  function openEdit(habit: HabitRow) {
    setDrawer({
      mode: "edit",
      draft: {
        id: habit.id,
        name: habit.name,
        category: habit.category,
        description: habit.description ?? "",
        targetTime: habit.targetTime ?? "07:00",
        defaultExpectedMinutes: habit.defaultExpectedMinutes
      }
    });
  }

  async function saveHabit(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || !drawer.draft.name.trim()) return;
    setSaving(true);
    const isEdit = drawer.mode === "edit" && drawer.draft.id;
    await fetch("/api/habits", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: drawer.draft.id, ...drawer.draft } : drawer.draft)
    });
    await load(date);
    setSaving(false);
    setDrawer(null);
  }

  async function deleteHabit() {
    if (!drawer?.draft.id) return;
    setSaving(true);
    const response = await fetch(`/api/habits?id=${drawer.draft.id}&date=${date}`, { method: "DELETE" });
    setData(await response.json());
    setSaving(false);
    setDrawer(null);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Habits"
        title="Today"
        detail="See the day clearly, mark what happened, and open the side panel only when you want to change the habit itself."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => load()} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add habit
            </PrimaryButton>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <TextInput
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate);
            load(nextDate);
          }}
          className="w-auto min-w-[170px]"
        />
        <Pill>{saving ? "Syncing" : "Live"}</Pill>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Done today" value={`${data.metrics.completedToday}/${data.metrics.totalToday}`} tone={data.metrics.completionRateToday >= 70 ? "good" : "neutral"} />
        <Metric label="Completion" value={`${data.metrics.completionRateToday}%`} />
        <Metric label="Planned time" value={formatDuration(plannedMinutes)} />
        <Metric label="Actual time" value={formatDuration(actualMinutes)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <SoftPanel className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Habits for {date}</h2>
            <span className="text-sm text-slate-400">{data.habits.length}</span>
          </div>
          {data.habits.length === 0 ? (
            <EmptyState text="No habits yet. Add only the behaviors you want to see every day." />
          ) : (
            <div className="space-y-2">
              {data.habits.map((habit) => (
                <div key={habit.id} className="rounded-[20px] bg-white/[0.03] px-4 py-3 ring-1 ring-white/6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => openEdit(habit)} className="w-full text-left">
                        <p className="truncate text-base font-semibold text-slate-100">{habit.name}</p>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill>{habit.category}</Pill>
                        {habit.targetTime ? <Pill>{habit.targetTime}</Pill> : null}
                        <Pill>{formatDuration(habit.defaultExpectedMinutes)}</Pill>
                        <Pill className={statusTone(habit.checkin.status as HabitStatus)}>{habit.checkin.status}</Pill>
                      </div>
                      {habit.description ? <p className="mt-2 text-sm text-slate-400">{habit.description}</p> : null}
                    </div>
                    <GhostButton onClick={() => openEdit(habit)} className="min-h-9 rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8">
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </GhostButton>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Segmented className="w-full lg:w-auto">
                      {([
                        { key: "done", label: "Done" },
                        { key: "planned", label: "Plan" },
                        { key: "skipped", label: "Skip" }
                      ] as const).map((option) => (
                        <SegmentedButton
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
                        label="Actual duration"
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
              <Clock3 className="h-4 w-4 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-100">Day rhythm</h2>
            </div>
            {timelineItems.length === 0 ? (
              <EmptyState text="No day rhythm yet. Add a target time to start shaping the day." />
            ) : (
              <div className="space-y-2">
                {timelineItems.map((item) => (
                  <div key={item.id} className="rounded-[18px] bg-white/[0.03] px-4 py-3 ring-1 ring-white/6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{item.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                      </div>
                      <span className="text-sm text-slate-400">{item.startTime} - {item.endTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SoftPanel>

          <SoftPanel className="p-5">
            <h2 className="text-lg font-semibold text-slate-100">Category snapshot</h2>
            <div className="mt-4 space-y-2">
              {buildCategorySummary(data.habits).length === 0 ? (
                <p className="text-sm text-slate-500">Categories appear once you have habits to track.</p>
              ) : (
                buildCategorySummary(data.habits).map((item) => (
                  <div key={item.category} className="flex items-center justify-between rounded-[16px] bg-white/[0.03] px-3 py-2 text-sm ring-1 ring-white/6">
                    <span className="text-slate-300">{item.category}</span>
                    <span className="text-slate-100">{item.done}/{item.total}</span>
                  </div>
                ))
              )}
            </div>
          </SoftPanel>
        </div>
      </div>

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? "Edit habit" : "Add habit"}
        description="Change the habit itself here. Daily check-ins stay lightweight on the page."
        onClose={() => setDrawer(null)}
        width="md"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {drawer?.mode === "edit" ? (
                <SecondaryButton onClick={deleteHabit} className="text-risk">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </SecondaryButton>
              ) : null}
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setDrawer(null)}>Cancel</SecondaryButton>
              <PrimaryButton form="habit-editor-form" type="submit" disabled={!drawer?.draft.name.trim() || saving}>
                {saving ? "Saving..." : drawer?.mode === "edit" ? "Save habit" : "Create habit"}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        {drawer ? (
          <form id="habit-editor-form" onSubmit={saveHabit} className="space-y-4">
            <div>
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={drawer.draft.name}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, name: event.target.value } } : current)}
                className="mt-2"
                placeholder="Wake up, review notes, workout..."
              />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <TextArea
                value={drawer.draft.description}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, description: event.target.value } } : current)}
                className="mt-2 min-h-24"
                placeholder="Why this habit matters."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Category</FieldLabel>
                <TextInput
                  value={drawer.draft.category}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, category: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>Target time</FieldLabel>
                <TextInput
                  type="time"
                  value={drawer.draft.targetTime}
                  onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, targetTime: event.target.value } } : current)}
                  className="mt-2"
                />
              </div>
            </div>
            <DurationInput
              label="Expected duration"
              value={drawer.draft.defaultExpectedMinutes}
              onChange={(defaultExpectedMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, defaultExpectedMinutes } } : current)}
              showStored={false}
            />
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function buildCategorySummary(habits: HabitData["habits"]) {
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

function statusTone(status: HabitStatus) {
  if (status === "done") return "bg-good/10 text-good ring-good/15";
  if (status === "skipped") return "bg-risk/10 text-risk ring-risk/15";
  return "bg-white/[0.05] text-slate-300 ring-white/8";
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[22px] bg-white/[0.03] px-4 py-12 text-center text-sm text-slate-500 ring-1 ring-white/6">{text}</div>;
}
