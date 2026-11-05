import { expectBoolean, expectJsonObject, expectNullableString, expectNumber, expectString, parseJsonArray, requestJson } from "@/lib/http/apiClient";
import { DEADLINE_KINDS, type Course, type CoursesData, type Deadline, type DeadlineDraft, type DeadlineKind } from "../domain/courses";

const COURSES_URL = "/api/courses";
const JSON_HEADERS = { "Content-Type": "application/json" };
export const CALENDAR_EXPORT_URL = `${COURSES_URL}/calendar.ics`;

export function fetchCourses(signal?: AbortSignal): Promise<CoursesData> {
  return requestJson(COURSES_URL, (payload) => {
    const response = expectJsonObject(payload, "courses");
    return {
      courses: parseJsonArray(response.courses, "courses.courses", parseCourse),
      deadlines: parseJsonArray(response.deadlines, "courses.deadlines", parseDeadline),
      today: expectString(response.today, "courses.today")
    };
  }, { signal });
}

export function createCourse(name: string): Promise<void> {
  return requestJson(COURSES_URL, () => undefined, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name }) });
}

export function renameCourse(id: string, name: string): Promise<void> {
  return requestJson(COURSES_URL, () => undefined, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ id, name }) });
}

export function deleteCourse(id: string): Promise<void> {
  return requestJson(`${COURSES_URL}?id=${encodeURIComponent(id)}`, () => undefined, { method: "DELETE" });
}

export function createDeadline(draft: DeadlineDraft): Promise<void> {
  const body = { courseId: draft.courseId, title: draft.title.trim(), kind: draft.kind, date: draft.date, time: draft.time || null };
  return requestJson(`${COURSES_URL}/deadlines`, () => undefined, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
}

export function deleteDeadline(id: string): Promise<void> {
  return requestJson(`${COURSES_URL}/deadlines?id=${encodeURIComponent(id)}`, () => undefined, { method: "DELETE" });
}

function parseCourse(payload: unknown, context: string): Course {
  const course = expectJsonObject(payload, context);
  const parsedCourse: Course = {
    id: expectString(course.id, `${context}.id`),
    name: expectString(course.name, `${context}.name`),
    color: expectString(course.color, `${context}.color`),
    archived: expectBoolean(course.archived, `${context}.archived`)
  };
  return parsedCourse;
}

function parseDeadline(payload: unknown, context: string): Deadline {
  const deadline = expectJsonObject(payload, context);
  const kind = expectString(deadline.kind, `${context}.kind`);
  const parsedDeadline: Deadline = {
    id: expectString(deadline.id, `${context}.id`),
    courseId: expectNullableString(deadline.courseId, `${context}.courseId`),
    title: expectString(deadline.title, `${context}.title`),
    kind: DEADLINE_KINDS.includes(kind as DeadlineKind) ? (kind as DeadlineKind) : "other",
    date: expectString(deadline.date, `${context}.date`),
    time: expectNullableString(deadline.time, `${context}.time`),
    durationMinutes: expectNumber(deadline.durationMinutes, `${context}.durationMinutes`),
    note: expectNullableString(deadline.note, `${context}.note`)
  };
  return parsedDeadline;
}
