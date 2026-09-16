"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card, Metric } from "@/components/ui";
import type { ObjectivesData, WeeklyPlanBlock } from "../domain/objective";
import { hours } from "../domain/planning";

type Props = {
  data: ObjectivesData;
  objectiveId: string;
  objectiveIds: string[];
  onCreateBlock: (date: string, objectiveId?: string, startTime?: string) => void;
  onEditBlock: (block: WeeklyPlanBlock) => void;
};

export function ObjectiveHourlyCalendar({ data, objectiveId, objectiveIds, onCreateBlock, onEditBlock }: Props) {
  const blocks = data.weeklyBlocks.filter((block) => !objectiveId || (block.objectiveId !== null && objectiveIds.includes(block.objectiveId)));
  const events = blocks.map((block) => ({
    id: block.id, title: `${block.title} · ${hours(block.durationMinutes)}`,
    start: block.startTime && !block.flexible ? `${block.date}T${block.startTime}` : block.date,
    end: block.endTime && !block.flexible ? `${block.date}T${block.endTime}` : block.startTime && !block.flexible ? new Date(new Date(`${block.date}T${block.startTime}`).getTime() + block.durationMinutes * 60000) : undefined,
    allDay: block.flexible || !block.startTime,
    backgroundColor: "rgb(var(--color-accent) / 0.16)", borderColor: block.objectiveColor ?? "rgb(var(--color-accent))",
    textColor: "rgb(var(--color-ink))", extendedProps: { block }
  }));
  const busyEvents = data.weeklyDays.flatMap((day) => day.events).map((event) => ({
    id: `event-${event.id}`, title: event.title, start: event.start, end: event.end,
    display: "background", backgroundColor: "rgb(var(--color-muted) / 0.12)"
  }));
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <Metric label="Planned blocks" value={hours(blocks.reduce((sum, block) => sum + block.durationMinutes, 0))} detail={`${blocks.length} blocks in this view`} />
      <Metric label="Recorded execution" value={hours(blocks.reduce((sum, block) => sum + (block.actualMinutes ?? 0), 0))} />
      <Metric label="Calendar commitments" value={String(busyEvents.length)} detail="Shaded in the calendar" />
      <Metric label="Weekly focus capacity" value={`${hours(data.weekSummary.plannedFocusMinutes)} / ${hours(data.weekSummary.focusTargetMinutes)}`} detail={data.weekSummary.plannedFocusMinutes > data.weekSummary.focusTargetMinutes ? `${hours(data.weekSummary.plannedFocusMinutes - data.weekSummary.focusTargetMinutes)} above your weekly target` : "All work / study blocks · target set in Performance"} tone={data.weekSummary.plannedFocusMinutes > data.weekSummary.focusTargetMinutes ? "warn" : "neutral"} />
    </div>
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Weekly schedule</h2><p className="text-xs text-muted">Select a slot to plan · Select a block to edit</p></div>
      <div className="thin-scrollbar overflow-x-auto rounded-2xl border border-line">
        <div className="calendar-engine min-w-[700px]">
          <FullCalendar key={data.weekId} plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" initialDate={data.weekDays[0]} firstDay={1} headerToolbar={false} height={660} allDayText="Flexible" nowIndicator slotMinTime="00:00:00" slotMaxTime="24:00:00" scrollTime="08:00:00" events={[...events, ...busyEvents]} eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }} slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            dateClick={(selection) => onCreateBlock(selection.dateStr.slice(0, 10), objectiveId, selection.allDay ? undefined : selection.dateStr.slice(11, 16))}
            eventClick={(selection) => { const block = blocks.find((item) => item.id === selection.event.id); if (block) onEditBlock(block); }} />
        </div>
      </div>
    </Card>
  </div>;
}
