"use client";

import { CalendarPlus, X } from "lucide-react";
import { SliderField } from "@/components/SliderField";
import { FieldLabel, IconButton, PrimaryButton, SelectInput, TextInput } from "@/components/ui";

const eventTypes = ["exam", "interview", "deadline", "admin", "social", "training", "recovery", "travel", "personal"];
const impacts = ["low", "medium", "high", "critical"];

export function CalendarEventForm({
  title,
  type,
  impact,
  start,
  end,
  expectedStress,
  expectedPreparationLoad,
  onChange,
  onSubmit,
  onClose
}: {
  title: string;
  type: string;
  impact: string;
  start: string;
  end: string;
  expectedStress: number;
  expectedPreparationLoad: number;
  onChange: (patch: Record<string, string | number>) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Context event</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Create event</h2>
        </div>
        {onClose ? (
          <IconButton type="button" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>
      <div>
        <FieldLabel>Title</FieldLabel>
        <TextInput
          value={title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="mt-2"
          placeholder="Exam, interview, deadline..."
        />
      </div>
      <div>
        <FieldLabel>Type</FieldLabel>
        <SelectInput value={type} onChange={(event) => onChange({ type: event.target.value })} className="mt-2 w-full">
          {eventTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectInput>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Start</FieldLabel>
          <TextInput
            type="datetime-local"
            value={start}
            onChange={(event) => onChange({ start: event.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <FieldLabel>End</FieldLabel>
          <TextInput
            type="datetime-local"
            value={end}
            onChange={(event) => onChange({ end: event.target.value })}
            className="mt-2"
          />
        </div>
      </div>
      <div>
        <FieldLabel>Impact</FieldLabel>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {impacts.map((item) => (
            <IconButton
              type="button"
              key={item}
              onClick={() => onChange({ impact: item })}
              className={impact === item ? "border-violet bg-violet/15 text-violet" : ""}
            >
              {item}
            </IconButton>
          ))}
        </div>
      </div>
      <SliderField label="Expected stress" value={expectedStress} onChange={(value) => onChange({ expectedStress: value })} />
      <SliderField
        label="Preparation load"
        value={expectedPreparationLoad}
        onChange={(value) => onChange({ expectedPreparationLoad: value })}
      />
      <PrimaryButton className="w-full" disabled={!title.trim()}>
        <CalendarPlus className="h-4 w-4" />
        Add event
      </PrimaryButton>
    </form>
  );
}
