"use client";

import { PencilLine, PieChart, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";
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
  SoftPanel,
  TextArea,
  TextInput
} from "@/components/ui";
import type { getTimeAllocationData } from "@/lib/timeAllocation";

type TimeAllocationData = Awaited<ReturnType<typeof getTimeAllocationData>>;
type AllocationRow = TimeAllocationData["rows"][number];

type AllocationDraft = {
  id?: string;
  name: string;
  objective: string;
  targetWeight: number;
  plannedMinutes: number;
  plannedMinutesManual: boolean;
  actualMinutes: number;
  color: string;
};

const colors = ["#8da2fb", "#57c59a", "#f0c56b", "#f08b8f", "#76b2ff", "#9282ff", "#6fd1c6", "#c6d2ff"];

export function TimeAllocationClient({ initialData }: { initialData: TimeAllocationData }) {
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.date);
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; draft: AllocationDraft } | null>(null);
  const [saving, setSaving] = useState(false);

  const targetStatus = data.targetWeightTotal === 100 ? "Balanced" : data.targetWeightTotal > 100 ? "Over 100%" : "Below 100%";
  const targetPie = useMemo(
    () => data.rows.filter((row: AllocationRow) => row.targetWeight > 0).map((row: AllocationRow) => ({ name: row.name, value: row.targetWeight, color: row.color })),
    [data.rows]
  );
  const actualPie = useMemo(
    () => data.rows.filter((row: AllocationRow) => row.actualWeight > 0).map((row: AllocationRow) => ({ name: row.name, value: row.actualWeight, color: row.color })),
    [data.rows]
  );
  const draftAutoPlannedMinutes = drawer ? Math.round((data.dayBudgetMinutes * Math.max(0, drawer.draft.targetWeight)) / 100) : 0;

  async function load(nextDate = date) {
    setSaving(true);
    const response = await fetch(`/api/time-allocation?date=${nextDate}`);
    setData(await response.json());
    setSaving(false);
  }

  async function saveDayBudget(dayBudgetMinutes: number) {
    setSaving(true);
    const response = await fetch("/api/time-allocation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "day_budget",
        date,
        dayBudgetMinutes
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
        objective: "",
        targetWeight: 10,
        plannedMinutes: 0,
        plannedMinutesManual: false,
        actualMinutes: 0,
        color: colors[data.rows.length % colors.length]
      }
    });
  }

  function openEdit(row: AllocationRow) {
    setDrawer({
      mode: "edit",
      draft: {
        id: row.id,
        name: row.name,
        objective: row.objective ?? "",
        targetWeight: row.targetWeight,
        plannedMinutes: row.plannedMinutesManual ? row.plannedMinutesStored : row.autoPlannedMinutes,
        plannedMinutesManual: row.plannedMinutesManual,
        actualMinutes: row.actualMinutes,
        color: row.color
      }
    });
  }

  async function saveAllocation(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || !drawer.draft.name.trim()) return;
    setSaving(true);
    const isEdit = drawer.mode === "edit" && drawer.draft.id;
    if (isEdit) {
      await fetch("/api/time-allocation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: drawer.draft.id,
          name: drawer.draft.name,
          objective: drawer.draft.objective,
          targetWeight: drawer.draft.targetWeight,
          color: drawer.draft.color
        })
      });
      await fetch("/api/time-allocation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "allocation",
          date,
          categoryId: drawer.draft.id,
          plannedMinutes: drawer.draft.plannedMinutesManual ? drawer.draft.plannedMinutes : 0,
          plannedMinutesManual: drawer.draft.plannedMinutesManual,
          actualMinutes: drawer.draft.actualMinutes
        })
      });
    } else {
      const response = await fetch("/api/time-allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: drawer.draft.name,
          objective: drawer.draft.objective,
          targetWeight: drawer.draft.targetWeight,
          color: drawer.draft.color
        })
      });
      const created = await response.json();
      await fetch("/api/time-allocation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "allocation",
          date,
          categoryId: created.category.id,
          plannedMinutes: drawer.draft.plannedMinutesManual ? drawer.draft.plannedMinutes : 0,
          plannedMinutesManual: drawer.draft.plannedMinutesManual,
          actualMinutes: drawer.draft.actualMinutes
        })
      });
    }
    await load(date);
    setSaving(false);
    setDrawer(null);
  }

  async function deleteCategory() {
    if (!drawer?.draft.id) return;
    setSaving(true);
    const response = await fetch(`/api/time-allocation?id=${drawer.draft.id}&date=${date}`, { method: "DELETE" });
    setData(await response.json());
    setSaving(false);
    setDrawer(null);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Time allocation"
        title="Portfolio"
        detail="Keep the portfolio readable on the page. Use the side panel only when you need to add or adjust a block."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => load()} disabled={saving}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add block
            </PrimaryButton>
          </div>
        }
      />

      <SoftPanel className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,280px)_auto] lg:items-end">
          <div className="min-w-0">
            <FieldLabel>Date</FieldLabel>
            <TextInput
              type="date"
              value={date}
              onChange={(event) => {
                const nextDate = event.target.value;
                setDate(nextDate);
                load(nextDate);
              }}
              className="mt-2 min-w-0"
            />
          </div>
          <DurationInput
            label="Day budget"
            value={data.dayBudgetMinutes}
            onChange={(dayBudgetMinutes) => void saveDayBudget(dayBudgetMinutes)}
            placeholder="12h"
            showStored={false}
          />
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Pill>{targetStatus}</Pill>
            <Pill>{data.hasManualPlanOverrides ? "manual overrides" : "auto plan"}</Pill>
          </div>
        </div>
      </SoftPanel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Day budget" value={formatDuration(data.dayBudgetMinutes)} />
        <Metric label="Planned today" value={formatDuration(data.plannedMinutesTotal)} detail={`auto ${formatDuration(data.plannedMinutesAutoTotal)}`} tone={data.overBudgetMinutes > 0 ? "warn" : "neutral"} />
        <Metric
          label={data.overBudgetMinutes > 0 ? "Over budget" : "Remaining"}
          value={formatDuration(data.overBudgetMinutes > 0 ? data.overBudgetMinutes : data.remainingBudgetMinutes)}
          tone={data.overBudgetMinutes > 0 ? "warn" : "good"}
        />
        <Metric label="Logged today" value={formatDuration(data.actualMinutesTotal)} />
        <Metric label="Target total" value={`${data.targetWeightTotal}%`} tone={data.targetWeightTotal === 100 ? "good" : "warn"} detail={`${data.rows.length} blocks`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <SoftPanel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-100">Allocation overview</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PieBlock title="Target" data={targetPie} emptyText="Add target percentages to shape the portfolio." />
            <PieBlock title="Actual today" data={actualPie} emptyText="Log time during the day to see the real allocation." />
          </div>
        </SoftPanel>

        <SoftPanel className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Active blocks</h2>
            <span className="text-sm text-slate-400">{data.rows.length}</span>
          </div>
          {data.rows.length === 0 ? (
            <EmptyState text="No active blocks yet. Add only the time buckets you actually want to manage." />
          ) : (
            <div className="space-y-2">
              {data.rows.map((row: AllocationRow) => (
                <div
                  key={row.id}
                  className="rounded-[20px] bg-white/[0.03] px-4 py-3 text-left ring-1 ring-white/6 transition hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => openEdit(row)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                        <p className="truncate text-base font-semibold text-slate-100">{row.name}</p>
                      </div>
                      {row.objective ? <p className="mt-1 line-clamp-2 text-sm text-slate-400">{row.objective}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill>{row.targetWeight}% target</Pill>
                        <Pill>{formatDuration(row.plannedMinutes)} planned</Pill>
                        <Pill className={row.plannedMinutesManual ? "bg-white/[0.08] text-slate-100 ring-white/10" : ""}>
                          {row.plannedMinutesManual ? "manual" : `${formatDuration(row.autoPlannedMinutes)} auto`}
                        </Pill>
                        <Pill>{formatDuration(row.actualMinutes)} real</Pill>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{row.actualWeight}% actual</span>
                      <GhostButton type="button" onClick={() => openEdit(row)} className="min-h-9 rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/8">
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </GhostButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SoftPanel>
      </div>

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? "Edit time block" : "Add time block"}
        description="Define the block once, then keep the main page calm and readable."
        onClose={() => setDrawer(null)}
        width="md"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {drawer?.mode === "edit" ? (
                <SecondaryButton onClick={deleteCategory} className="text-risk">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </SecondaryButton>
              ) : null}
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setDrawer(null)}>Cancel</SecondaryButton>
              <PrimaryButton form="allocation-editor-form" type="submit" disabled={!drawer?.draft.name.trim() || saving}>
                {saving ? "Saving..." : drawer?.mode === "edit" ? "Save block" : "Create block"}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        {drawer ? (
          <form id="allocation-editor-form" onSubmit={saveAllocation} className="space-y-4">
            <div>
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={drawer.draft.name}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, name: event.target.value } } : current)}
                className="mt-2"
                placeholder="Deep work, school, sleep..."
              />
            </div>
            <div>
              <FieldLabel>Objective</FieldLabel>
              <TextArea
                value={drawer.draft.objective}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, objective: event.target.value } } : current)}
                className="mt-2 min-h-28"
                placeholder="Why this block deserves a place in the portfolio."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Target %</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  value={drawer.draft.targetWeight}
                  onChange={(event) =>
                    setDrawer((current) =>
                      current ? { ...current, draft: { ...current.draft, targetWeight: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } } : current
                    )
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>Color</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDrawer((current) => current ? { ...current, draft: { ...current.draft, color } } : current)}
                      className={`h-9 w-9 rounded-full ring-2 transition ${drawer.draft.color === color ? "ring-white" : "ring-transparent"}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Choose ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <SoftPanel className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-medium text-slate-200">Auto plan from available time</p>
                  <p className="mt-1 text-sm text-slate-400">
                    With a day budget of {formatDuration(data.dayBudgetMinutes)}, {drawer.draft.targetWeight}% maps to{" "}
                    <span className="font-semibold text-slate-100">{formatDuration(draftAutoPlannedMinutes)}</span>.
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-2 text-sm text-slate-300 ring-1 ring-white/8">
                  <input
                    type="checkbox"
                    checked={drawer.draft.plannedMinutesManual}
                    onChange={(event) =>
                      setDrawer((current) =>
                        current
                          ? {
                              ...current,
                              draft: {
                                ...current.draft,
                                plannedMinutesManual: event.target.checked,
                                plannedMinutes: event.target.checked ? current.draft.plannedMinutes || draftAutoPlannedMinutes : draftAutoPlannedMinutes
                              }
                            }
                          : current
                      )
                    }
                    className="h-4 w-4 accent-accent"
                  />
                  Manual override
                </label>
              </div>
            </SoftPanel>
            <div className="grid gap-4 md:grid-cols-2">
              <DurationInput
                label={drawer.draft.plannedMinutesManual ? "Planned today" : "Planned today (auto)"}
                value={drawer.draft.plannedMinutesManual ? drawer.draft.plannedMinutes : draftAutoPlannedMinutes}
                onChange={(plannedMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, plannedMinutes, plannedMinutesManual: true } } : current)}
                showStored={false}
              />
              <DurationInput
                label="Actual today"
                value={drawer.draft.actualMinutes}
                onChange={(actualMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, actualMinutes } } : current)}
                showStored={false}
              />
            </div>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function PieBlock({
  title,
  data,
  emptyText
}: {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
  emptyText: string;
}) {
  return (
    <div className="rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/6">
      <h3 className="text-sm font-medium text-slate-300">{title}</h3>
      {data.length === 0 ? (
        <div className="grid h-56 place-items-center text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value}%`, name]}
                  contentStyle={{ background: "#161d29", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, color: "#f8fafc" }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="font-medium text-slate-100">{entry.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[22px] bg-white/[0.03] px-4 py-12 text-center text-sm text-slate-500 ring-1 ring-white/6">{text}</div>;
}
