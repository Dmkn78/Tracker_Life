"use client";

import { ChevronLeft, ChevronRight, PencilLine, PieChart, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Segmented,
  SegmentedButton,
  SoftPanel,
  TextArea,
  TextInput
} from "@/components/ui";
import {
  archiveTimeAllocationCategory,
  loadTimeAllocation,
  saveTimeAllocationBudget,
  saveTimeAllocationPortfolio
} from "@/features/time-allocation/api/timeAllocationApi";
import { TaskTimeBreakdownPanel } from "@/features/time-allocation/components/TaskTimeBreakdownPanel";
import type {
  TimeAllocationData,
  TimeAllocationDraft,
  TimeAllocationRow
} from "@/features/time-allocation/domain/timeAllocation";
import { ApiError } from "@/lib/http/apiClient";
import {
  canonicalAllocationAnchor,
  shiftAllocationPeriod,
  type TimeAllocationPeriod
} from "@/features/time-allocation/domain/allocationPeriod";
import { createRequestGate } from "@/features/shared/application/requestGate";
import { createSerializedWriteCoordinator } from "@/features/shared/application/serializedWriteCoordinator";
import { toDateKey } from "@/lib/dates";
import { useLocale } from "@/features/interface/localization/LocaleProvider";

const colors = ["#8da2fb", "#57c59a", "#f0c56b", "#f08b8f", "#76b2ff", "#9282ff", "#6fd1c6", "#c6d2ff"];

export function TimeAllocationClient({
  initialData,
  hasExplicitSelection,
  onSelectionChange
}: {
  initialData: TimeAllocationData;
  hasExplicitSelection: boolean;
  onSelectionChange?: (period: TimeAllocationPeriod, date: string) => void;
}) {
  const { locale } = useLocale();
  const copy = TIME_ALLOCATION_COPY[locale];
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.date);
  const [period, setPeriod] = useState<TimeAllocationPeriod>(initialData.period);
  const [view, setView] = useState<"portfolio" | "tasks">("portfolio");
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; draft: TimeAllocationDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestGateRef = useRef(createRequestGate());
  const mountedRef = useRef(true);
  const mutationInFlightRef = useRef(false);
  const selectionRef = useRef(`${initialData.period}:${initialData.date}`);
  const writeCoordinatorRef = useRef<ReturnType<typeof createAllocationWriteCoordinator> | null>(null);
  if (!writeCoordinatorRef.current) {
    writeCoordinatorRef.current = createAllocationWriteCoordinator((key, nextData) => {
      if (selectionRef.current === key && !requestGateRef.current.isDisposed()) setData(nextData);
    });
    writeCoordinatorRef.current.synchronizeConfirmedState(selectionRef.current, initialData);
  }

  const targetStatus = data.targetWeightTotal === 100 ? copy.balanced : data.targetWeightTotal > 100 ? copy.overTarget : copy.belowTarget;
  const targetPie = useMemo(
    () => data.rows.filter((row: TimeAllocationRow) => row.targetWeight > 0).map((row: TimeAllocationRow) => ({ name: row.name, value: row.targetWeight, color: row.color })),
    [data.rows]
  );
  const actualPie = useMemo(
    () => data.rows.filter((row: TimeAllocationRow) => row.actualWeight > 0).map((row: TimeAllocationRow) => ({ name: row.name, value: row.actualWeight, color: row.color })),
    [data.rows]
  );
  const draftAutoPlannedMinutes = drawer ? Math.round((data.periodBudgetMinutes * Math.max(0, drawer.draft.targetWeight)) / 100) : 0;

  useEffect(() => {
    const storedPeriod = hasExplicitSelection ? null : window.localStorage.getItem("time-allocation:period");
    if (storedPeriod === "day" || storedPeriod === "week" || storedPeriod === "month") {
      const storedAnchor = canonicalAllocationAnchor(storedPeriod, toDateKey());
      if (storedPeriod !== period || storedAnchor !== date) void selectRange(storedPeriod, storedAnchor);
    }
    return () => {
      mountedRef.current = false;
      requestGateRef.current.dispose();
    };
  // Initial hydration only; selectRange is intentionally driven from the persisted preference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(nextPeriod = period, requestedDate = date) {
    const nextDate = canonicalAllocationAnchor(nextPeriod, requestedDate);
    const request = requestGateRef.current.beginRead();
    if (!request) return;
    const key = `${nextPeriod}:${nextDate}`;
    selectionRef.current = key;
    setPeriod(nextPeriod);
    setDate(nextDate);
    setSaving(true);
    setError(null);
    try {
      const nextData = await loadTimeAllocation(nextPeriod, nextDate, request.signal);
      if (!request.signal.aborted && requestGateRef.current.isCurrentRead(request.generation)) {
        writeCoordinatorRef.current!.synchronizeConfirmedState(key, nextData);
        setData(nextData);
      }
    } catch (loadError) {
      if (!request.signal.aborted && requestGateRef.current.isCurrentRead(request.generation)) {
        setError(readApiErrorMessage(loadError, copy.loadError));
      }
    } finally {
      if (requestGateRef.current.isCurrentRead(request.generation)) setSaving(false);
    }
  }

  async function selectRange(nextPeriod: TimeAllocationPeriod, requestedDate: string) {
    if (mutationInFlightRef.current) return;
    const nextDate = canonicalAllocationAnchor(nextPeriod, requestedDate);
    window.localStorage.setItem("time-allocation:period", nextPeriod);
    if (onSelectionChange) onSelectionChange(nextPeriod, nextDate);
    else {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("period", nextPeriod);
      nextUrl.searchParams.set("date", nextDate);
      window.history.replaceState(window.history.state, "", nextUrl);
    }
    await load(nextPeriod, nextDate);
  }

  function refreshAll() {
    if (mutationInFlightRef.current) return;
    setRefreshVersion((currentVersion) => currentVersion + 1);
    void load();
  }

  async function saveBudget(budgetMinutes: number) {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    const operationKey = selectionRef.current;
    const operationPeriod = period;
    const operationDate = date;
    const operationData = data;
    setSaving(true);
    setError(null);
    try {
      requestGateRef.current.invalidateReads();
      writeCoordinatorRef.current!.synchronizeConfirmedState(operationKey, operationData);
      await writeCoordinatorRef.current!.enqueueWrite(
        operationKey,
        () => saveTimeAllocationBudget(operationPeriod, operationDate, budgetMinutes)
      );
    } catch (saveError) {
      if (isRelevantOperation(operationKey)) {
        setError(readApiErrorMessage(saveError, copy.budgetError));
      }
    } finally {
      mutationInFlightRef.current = false;
      if (isRelevantOperation(operationKey)) setSaving(false);
    }
  }

  function openCreate() {
    if (saving || mutationInFlightRef.current) return;
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

  function openEdit(row: TimeAllocationRow) {
    if (saving || mutationInFlightRef.current) return;
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
    if (!drawer || !drawer.draft.name.trim() || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    const operationKey = selectionRef.current;
    const operationPeriod = period;
    const operationDate = date;
    const operationData = data;
    const operationDraft = { ...drawer.draft };
    const operationAutoPlannedMinutes = draftAutoPlannedMinutes;
    setSaving(true);
    setError(null);
    try {
      const draftToSave = operationPeriod === "day" || operationDraft.plannedMinutesManual
        ? operationDraft
        : { ...operationDraft, plannedMinutes: operationAutoPlannedMinutes };
      requestGateRef.current.invalidateReads();
      writeCoordinatorRef.current!.synchronizeConfirmedState(operationKey, operationData);
      await writeCoordinatorRef.current!.enqueueWrite(
        operationKey,
        () => saveTimeAllocationPortfolio(operationPeriod, operationDate, draftToSave)
      );
      if (isRelevantOperation(operationKey)) setDrawer(null);
    } catch (saveError) {
      if (isRelevantOperation(operationKey)) {
        setError(readApiErrorMessage(saveError, copy.saveError));
      }
    } finally {
      mutationInFlightRef.current = false;
      if (isRelevantOperation(operationKey)) setSaving(false);
    }
  }

  async function deleteCategory() {
    const categoryId = drawer?.draft.id;
    if (!categoryId || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    const operationKey = selectionRef.current;
    const operationPeriod = period;
    const operationDate = date;
    const operationData = data;
    setSaving(true);
    setError(null);
    try {
      requestGateRef.current.invalidateReads();
      writeCoordinatorRef.current!.synchronizeConfirmedState(operationKey, operationData);
      await writeCoordinatorRef.current!.enqueueWrite(
        operationKey,
        () => archiveTimeAllocationCategory(categoryId, operationPeriod, operationDate)
      );
      if (isRelevantOperation(operationKey)) setDrawer(null);
    } catch (deleteError) {
      if (isRelevantOperation(operationKey)) {
        setError(readApiErrorMessage(deleteError, copy.archiveError));
      }
    } finally {
      mutationInFlightRef.current = false;
      if (isRelevantOperation(operationKey)) setSaving(false);
    }
  }

  function isRelevantOperation(operationKey: string): boolean {
    return mountedRef.current && !requestGateRef.current.isDisposed() && selectionRef.current === operationKey;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        detail={copy.detail}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={refreshAll} disabled={saving}>
              <RefreshCw className="h-4 w-4" />
              {copy.refresh}
            </SecondaryButton>
            <PrimaryButton onClick={openCreate} disabled={saving}>
              <Plus className="h-4 w-4" />
              {copy.addBlock}
            </PrimaryButton>
          </div>
        }
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-risk/10 px-4 py-3 text-sm text-risk ring-1 ring-risk/15">
          {error}
        </p>
      ) : null}

      <SoftPanel className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <FieldLabel>{copy.period}</FieldLabel>
            <Segmented>
              {(["day", "week", "month"] as const).map((periodOption) => (
                <SegmentedButton
                  key={periodOption}
                  active={period === periodOption}
                  disabled={saving}
                  onClick={() => void selectRange(periodOption, canonicalAllocationAnchor(periodOption, date))}
                >
                  {copy[periodOption]}
                </SegmentedButton>
              ))}
            </Segmented>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <SecondaryButton
              aria-label={copy.previous}
              disabled={saving}
              onClick={() => void selectRange(period, shiftAllocationPeriod(date, period, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </SecondaryButton>
            <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
              <FieldLabel>{copy.anchor}</FieldLabel>
              <TextInput
                type="date"
                value={date}
                disabled={saving}
                onChange={(event) => void selectRange(period, event.target.value)}
                className="mt-2 min-w-0"
              />
            </div>
            <SecondaryButton
              aria-label={copy.next}
              disabled={saving}
              onClick={() => void selectRange(period, shiftAllocationPeriod(date, period, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </SecondaryButton>
            <GhostButton disabled={saving} onClick={() => void selectRange(period, canonicalAllocationAnchor(period, toDateKey()))}>
              {copy.current}
            </GhostButton>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{data.rangeStart} → {data.rangeEnd}</p>
      </SoftPanel>

      <Segmented>
        <SegmentedButton disabled={saving} active={view === "portfolio"} onClick={() => setView("portfolio")}>
          {copy.portfolio}
        </SegmentedButton>
        <SegmentedButton disabled={saving} active={view === "tasks"} onClick={() => setView("tasks")}>
          {copy.byTask}
        </SegmentedButton>
      </Segmented>

      {view === "tasks" ? (
        <TaskTimeBreakdownPanel date={date} period={period} refreshVersion={refreshVersion} />
      ) : (
        <>
          <SoftPanel className="p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_auto] lg:items-end">
              <DurationInput
                label={`${copy[period]} ${copy.budget}`}
                value={data.periodBudgetMinutes}
                disabled={saving}
                onChange={(budgetMinutes) => void saveBudget(Math.min(data.maximumBudgetMinutes, budgetMinutes))}
                placeholder="12h"
                showStored={false}
              />
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Pill>{targetStatus}</Pill>
                <Pill>{data.hasManualPlanOverrides ? copy.manualOverrides : copy.autoPlan}</Pill>
              </div>
            </div>
          </SoftPanel>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Metric label={copy.periodBudget} value={formatDuration(data.periodBudgetMinutes)} />
            <Metric label={copy.planned} value={formatDuration(data.plannedMinutesTotal)} detail={`${copy.auto} ${formatDuration(data.plannedMinutesAutoTotal)}`} tone={data.overBudgetMinutes > 0 ? "warn" : "neutral"} />
            <Metric
              label={data.overBudgetMinutes > 0 ? copy.overBudget : copy.remaining}
              value={formatDuration(data.overBudgetMinutes > 0 ? data.overBudgetMinutes : data.remainingBudgetMinutes)}
              tone={data.overBudgetMinutes > 0 ? "warn" : "good"}
            />
            <Metric label={copy.loggedPeriod} value={formatDuration(data.actualMinutesTotal)} detail={copy.aggregatedActuals} />
            <Metric label={copy.targetTotal} value={`${data.targetWeightTotal}%`} tone={data.targetWeightTotal === 100 ? "good" : "warn"} detail={`${data.rows.length} ${copy.blocks}`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <SoftPanel className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-muted" />
                <h2 className="text-lg font-semibold text-ink">{copy.overview}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <PieBlock title={copy.target} data={targetPie} emptyText={copy.targetEmpty} />
                <PieBlock title={copy.actualPeriod} data={actualPie} emptyText={copy.actualEmpty} />
              </div>
            </SoftPanel>

            <SoftPanel className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">{copy.activeBlocks}</h2>
                <span className="text-sm text-muted">{data.rows.length}</span>
              </div>
              {data.rows.length === 0 ? (
                <EmptyState text={copy.emptyBlocks} />
              ) : (
                <div className="space-y-2">
                  {data.rows.map((row: TimeAllocationRow) => (
                    <div
                      key={row.id}
                      className="rounded-[20px] bg-panel2/50 px-4 py-3 text-left ring-1 ring-line/70 transition hover:bg-panel2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" disabled={saving} onClick={() => openEdit(row)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                            <p className="truncate text-base font-semibold text-ink">{row.name}</p>
                          </div>
                          {row.objective ? <p className="mt-1 line-clamp-2 text-sm text-muted">{row.objective}</p> : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Pill>{row.targetWeight}% {copy.target.toLowerCase()}</Pill>
                            <Pill>{formatDuration(row.plannedMinutes)} {copy.planned.toLowerCase()}</Pill>
                            <Pill className={row.plannedMinutesManual ? "bg-panel text-ink ring-line" : ""}>
                              {row.plannedMinutesManual ? copy.manual : `${formatDuration(row.autoPlannedMinutes)} ${copy.auto}`}
                            </Pill>
                            <Pill>{formatDuration(row.actualMinutes)} {copy.actual.toLowerCase()}</Pill>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">{row.actualWeight}% {copy.actual.toLowerCase()}</span>
                          <GhostButton type="button" disabled={saving} onClick={() => openEdit(row)} className="min-h-9 rounded-2xl bg-panel2/50 px-3 ring-1 ring-line">
                            <PencilLine className="h-4 w-4" />
                            {copy.edit}
                          </GhostButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SoftPanel>
          </div>
        </>
      )}

      <Drawer
        open={drawer != null}
        title={drawer?.mode === "edit" ? copy.editBlock : copy.addTimeBlock}
        description={copy.drawerDetail}
        onClose={() => {
          if (!mutationInFlightRef.current) setDrawer(null);
        }}
        width="md"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {drawer?.mode === "edit" ? (
                <SecondaryButton disabled={saving} onClick={deleteCategory} className="text-risk">
                  <Trash2 className="h-4 w-4" />
                  {copy.delete}
                </SecondaryButton>
              ) : null}
            </div>
            <div className="flex gap-2">
              <SecondaryButton disabled={saving} onClick={() => setDrawer(null)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton form="allocation-editor-form" type="submit" disabled={!drawer?.draft.name.trim() || saving}>
                {saving ? copy.saving : drawer?.mode === "edit" ? copy.saveBlock : copy.createBlock}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        {drawer ? (
          <form id="allocation-editor-form" onSubmit={saveAllocation} className="space-y-4">
            <div>
              <FieldLabel>{copy.name}</FieldLabel>
              <TextInput
                value={drawer.draft.name}
                disabled={saving}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, name: event.target.value } } : current)}
                className="mt-2"
                placeholder={copy.namePlaceholder}
              />
            </div>
            <div>
              <FieldLabel>{copy.objective}</FieldLabel>
              <TextArea
                value={drawer.draft.objective}
                disabled={saving}
                onChange={(event) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, objective: event.target.value } } : current)}
                className="mt-2 min-h-28"
                placeholder={copy.objectivePlaceholder}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>{copy.targetPercent}</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  value={drawer.draft.targetWeight}
                  disabled={saving}
                  onChange={(event) =>
                    setDrawer((current) =>
                      current ? { ...current, draft: { ...current.draft, targetWeight: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } } : current
                    )
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <FieldLabel>{copy.color}</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      disabled={saving}
                      onClick={() => setDrawer((current) => current ? { ...current, draft: { ...current.draft, color } } : current)}
                      className={`h-9 w-9 rounded-full ring-2 transition ${drawer.draft.color === color ? "ring-white" : "ring-transparent"}`}
                      style={{ backgroundColor: color }}
                      aria-label={`${copy.chooseColor} ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <SoftPanel className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-medium text-ink">{copy.autoPlanAvailable}</p>
                  <p className="mt-1 text-sm text-muted">
                    {copy.withBudget} {formatDuration(data.periodBudgetMinutes)}, {drawer.draft.targetWeight}% {copy.mapsTo}{" "}
                    <span className="font-semibold text-ink">{formatDuration(draftAutoPlannedMinutes)}</span>.
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-2xl bg-panel2/50 px-3 py-2 text-sm text-muted ring-1 ring-line">
                  <input
                    type="checkbox"
                    disabled={saving}
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
                  {copy.manualOverride}
                </label>
              </div>
            </SoftPanel>
            <div className="grid gap-4 md:grid-cols-2">
              <DurationInput
                label={drawer.draft.plannedMinutesManual ? copy.planned : `${copy.planned} (${copy.auto})`}
                value={drawer.draft.plannedMinutesManual ? drawer.draft.plannedMinutes : draftAutoPlannedMinutes}
                disabled={saving}
                onChange={(plannedMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, plannedMinutes, plannedMinutesManual: true } } : current)}
                showStored={false}
              />
              {period === "day" ? (
                <DurationInput
                  label={copy.actualToday}
                  value={drawer.draft.actualMinutes}
                  disabled={saving}
                  onChange={(actualMinutes) => setDrawer((current) => current ? { ...current, draft: { ...current.draft, actualMinutes } } : current)}
                  showStored={false}
                />
              ) : (
                <div className="rounded-2xl bg-panel2/50 p-3 text-sm text-muted ring-1 ring-line">
                  {copy.actualReadOnly}
                </div>
              )}
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
    <div className="rounded-[22px] bg-panel2/50 p-4 ring-1 ring-line/70">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      {data.length === 0 ? (
        <div className="grid h-56 place-items-center text-center text-sm text-muted">{emptyText}</div>
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
                <span className="flex min-w-0 items-center gap-2 text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="font-medium text-ink">{entry.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[22px] bg-panel2/50 px-4 py-12 text-center text-sm text-muted ring-1 ring-line/70">{text}</div>;
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

type AllocationWrite = () => Promise<TimeAllocationData>;

function createAllocationWriteCoordinator(
  publishData: (key: string, data: TimeAllocationData) => void
) {
  return createSerializedWriteCoordinator<string, TimeAllocationData, AllocationWrite>({
    applyWrite: (currentData) => currentData,
    executeWrite: (_key, write) => write(),
    publishState: publishData
  });
}

const TIME_ALLOCATION_COPY = {
  en: {
    eyebrow: "Time allocation", title: "Portfolio", detail: "Plan a civil day, ISO week, or calendar month while keeping actual time grounded in daily entries.",
    refresh: "Refresh", addBlock: "Add block", period: "Period", day: "Day", week: "Week", month: "Month",
    previous: "Previous period", next: "Next period", anchor: "Anchor", current: "Current", portfolio: "Portfolio", byTask: "By task",
    balanced: "Balanced", overTarget: "Over 100%", belowTarget: "Below 100%", budget: "budget", manualOverrides: "manual overrides", autoPlan: "auto plan",
    periodBudget: "Period budget", planned: "Planned", auto: "auto", overBudget: "Over budget", remaining: "Remaining",
    loggedPeriod: "Logged in period", aggregatedActuals: "aggregated from daily actuals", targetTotal: "Target total", blocks: "blocks",
    overview: "Allocation overview", target: "Target", targetEmpty: "Add target percentages to shape the portfolio.", actualPeriod: "Actual in period",
    actualEmpty: "Log daily time to see the real allocation for this period.", activeBlocks: "Active blocks", emptyBlocks: "No active blocks yet. Add only the time buckets you actually want to manage.",
    manual: "manual", actual: "Actual", edit: "Edit", editBlock: "Edit time block", addTimeBlock: "Add time block",
    drawerDetail: "Define the block once, then adjust its plan for the selected period.", delete: "Delete", cancel: "Cancel", saving: "Saving...", saveBlock: "Save block", createBlock: "Create block",
    name: "Name", namePlaceholder: "Deep work, school, sleep...", objective: "Objective", objectivePlaceholder: "Why this block deserves a place in the portfolio.",
    targetPercent: "Target %", color: "Color", chooseColor: "Choose", autoPlanAvailable: "Auto plan from available time", withBudget: "With a period budget of", mapsTo: "maps to",
    manualOverride: "Manual override", actualToday: "Actual today", actualReadOnly: "Actual time is read-only here and aggregated from daily entries.",
    loadError: "Unable to load time allocation.", budgetError: "Unable to save the period budget.", saveError: "Unable to save the allocation.", archiveError: "Unable to archive the allocation."
  },
  fr: {
    eyebrow: "Répartition du temps", title: "Portefeuille", detail: "Planifiez un jour civil, une semaine ISO ou un mois calendaire, avec un temps réel issu des saisies journalières.",
    refresh: "Actualiser", addBlock: "Ajouter un bloc", period: "Période", day: "Jour", week: "Semaine", month: "Mois",
    previous: "Période précédente", next: "Période suivante", anchor: "Ancre", current: "Actuelle", portfolio: "Portefeuille", byTask: "Par tâche",
    balanced: "Équilibré", overTarget: "Au-dessus de 100 %", belowTarget: "Sous 100 %", budget: "— budget", manualOverrides: "ajustements manuels", autoPlan: "plan automatique",
    periodBudget: "Budget de la période", planned: "Planifié", auto: "auto", overBudget: "Dépassement", remaining: "Restant",
    loggedPeriod: "Réel sur la période", aggregatedActuals: "agrégé depuis les saisies journalières", targetTotal: "Total cible", blocks: "blocs",
    overview: "Vue d’ensemble", target: "Cible", targetEmpty: "Ajoutez des pourcentages cibles pour structurer le portefeuille.", actualPeriod: "Réel sur la période",
    actualEmpty: "Saisissez le temps journalier pour voir la répartition réelle de cette période.", activeBlocks: "Blocs actifs", emptyBlocks: "Aucun bloc actif. Ajoutez seulement les catégories de temps que vous souhaitez piloter.",
    manual: "manuel", actual: "Réel", edit: "Modifier", editBlock: "Modifier le bloc", addTimeBlock: "Ajouter un bloc de temps",
    drawerDetail: "Définissez le bloc une fois, puis ajustez son plan pour la période sélectionnée.", delete: "Supprimer", cancel: "Annuler", saving: "Enregistrement…", saveBlock: "Enregistrer", createBlock: "Créer le bloc",
    name: "Nom", namePlaceholder: "Travail profond, études, sommeil…", objective: "Objectif", objectivePlaceholder: "Pourquoi ce bloc mérite sa place dans le portefeuille.",
    targetPercent: "Cible %", color: "Couleur", chooseColor: "Choisir", autoPlanAvailable: "Plan automatique selon le temps disponible", withBudget: "Avec un budget de période de", mapsTo: "correspond à",
    manualOverride: "Ajustement manuel", actualToday: "Réel aujourd’hui", actualReadOnly: "Le temps réel est en lecture seule ici et agrégé depuis les saisies journalières.",
    loadError: "Impossible de charger la répartition du temps.", budgetError: "Impossible d’enregistrer le budget de la période.", saveError: "Impossible d’enregistrer la répartition.", archiveError: "Impossible d’archiver la répartition."
  }
} as const;
