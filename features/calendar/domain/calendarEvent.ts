export type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  impact: string;
  expectedStress: number;
  expectedPreparationLoad: number;
};

export type CreateCalendarEventInput = Omit<CalendarEvent, "id">;
export type UpdateCalendarEventInput = { id: string } & Partial<CreateCalendarEventInput>;
