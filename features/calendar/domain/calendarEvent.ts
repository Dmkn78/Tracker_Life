export type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  impact: string;
  expectedStress: number;
  expectedPreparationLoad: number;
  companyId?: string | null;
  companyName?: string | null;
  companyColor?: string | null;
};

export type CreateCalendarEventInput = Omit<CalendarEvent, "id" | "companyId" | "companyColor"> & {
  companyName?: string;
};
export type UpdateCalendarEventInput = { id: string } & Partial<CreateCalendarEventInput>;
