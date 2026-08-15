"use client";

import { CalendarPlus, X } from "lucide-react";
import { SliderField } from "@/components/SliderField";
import { CompanyField } from "@/components/TagCompanyFields";
import { FieldLabel, IconButton, PrimaryButton, SelectInput, TextInput } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import type { TranslationKey } from "@/features/interface/localization/messages";
import type { Company } from "@/features/shared/domain/tagCompany";

const EVENT_TYPES = ["exam", "interview", "deadline", "admin", "social", "training", "recovery", "travel", "personal"] as const;
const EVENT_IMPACTS = ["low", "medium", "high", "critical"] as const;
const EVENT_TYPE_LABEL_KEYS: Record<(typeof EVENT_TYPES)[number], TranslationKey> = {
  exam: "calendar.type.exam",
  interview: "calendar.type.interview",
  deadline: "calendar.type.deadline",
  admin: "calendar.type.admin",
  social: "calendar.type.social",
  training: "calendar.type.training",
  recovery: "calendar.type.recovery",
  travel: "calendar.type.travel",
  personal: "calendar.type.personal"
};
const EVENT_IMPACT_LABEL_KEYS: Record<(typeof EVENT_IMPACTS)[number], TranslationKey> = {
  low: "calendar.impact.low",
  medium: "calendar.impact.medium",
  high: "calendar.impact.high",
  critical: "calendar.impact.critical"
};

export function CalendarEventForm({
  title,
  type,
  impact,
  start,
  end,
  expectedStress,
  expectedPreparationLoad,
  companyName,
  companies,
  mode = "create",
  isSaving = false,
  onChange,
  onSubmit,
  onDelete,
  onClose
}: {
  title: string;
  type: string;
  impact: string;
  start: string;
  end: string;
  expectedStress: number;
  expectedPreparationLoad: number;
  companyName: string;
  companies: Company[];
  mode?: "create" | "edit";
  isSaving?: boolean;
  onChange: (patch: Record<string, string | number>) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete?: () => void;
  onClose?: () => void;
}) {
  const { translate } = useLocale();
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={isSaving} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">{translate("calendar.eventContext")}</p>
          <h2 id="calendar-event-dialog-title" className="mt-1 text-lg font-semibold text-ink">
            {translate(mode === "create" ? "calendar.addEvent" : "calendar.editEvent")}
          </h2>
        </div>
        {onClose ? (
          <IconButton type="button" onClick={onClose} title={translate("calendar.close")}>
            <X className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>
      <div>
        <FieldLabel htmlFor="calendar-event-title">{translate("calendar.eventTitle")}</FieldLabel>
        <TextInput
          id="calendar-event-title"
          autoFocus
          value={title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="mt-2"
          placeholder={translate("calendar.eventTitlePlaceholder")}
        />
      </div>
      <div>
        <FieldLabel htmlFor="calendar-event-type">{translate("calendar.type")}</FieldLabel>
        <SelectInput id="calendar-event-type" value={type} onChange={(event) => onChange({ type: event.target.value })} className="mt-2 w-full">
          {EVENT_TYPES.map((item) => (
            <option key={item} value={item}>
              {translate(EVENT_TYPE_LABEL_KEYS[item])}
            </option>
          ))}
        </SelectInput>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="calendar-event-start">{translate("calendar.start")}</FieldLabel>
          <TextInput
            id="calendar-event-start"
            type="datetime-local"
            value={start}
            onChange={(event) => onChange({ start: event.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <FieldLabel htmlFor="calendar-event-end">{translate("calendar.end")}</FieldLabel>
          <TextInput
            id="calendar-event-end"
            type="datetime-local"
            value={end}
            onChange={(event) => onChange({ end: event.target.value })}
            className="mt-2"
          />
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-muted">{translate("calendar.impact")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={translate("calendar.impact")}>
          {EVENT_IMPACTS.map((item) => (
            <IconButton
              type="button"
              key={item}
              onClick={() => onChange({ impact: item })}
              aria-pressed={impact === item}
              className={impact === item ? "border-violet bg-violet/15 text-violet" : ""}
            >
              {translate(EVENT_IMPACT_LABEL_KEYS[item])}
            </IconButton>
          ))}
        </div>
      </fieldset>
      <CompanyField
        label={translate("calendar.companyOptional")}
        placeholder={translate("calendar.noCompany")}
        value={companyName}
        onChange={(value) => onChange({ companyName: value })}
        companies={companies}
      />
      <SliderField label={translate("calendar.expectedStress")} value={expectedStress} onChange={(value) => onChange({ expectedStress: value })} />
      <SliderField
        label={translate("calendar.preparationLoad")}
        value={expectedPreparationLoad}
        onChange={(value) => onChange({ expectedPreparationLoad: value })}
      />
      <div className="flex flex-wrap justify-between gap-2">
        {mode === "edit" && onDelete ? (
          <IconButton type="button" onClick={onDelete} className="border-risk/50 text-risk hover:border-risk hover:text-risk">
            {translate("calendar.delete")}
          </IconButton>
        ) : <span />}
        <PrimaryButton disabled={!title.trim() || isSaving}>
          <CalendarPlus className="h-4 w-4" />
          {translate(isSaving
            ? "calendar.saving"
            : mode === "create"
              ? "calendar.addEvent"
              : "calendar.saveEvent")}
        </PrimaryButton>
      </div>
      </fieldset>
    </form>
  );
}
