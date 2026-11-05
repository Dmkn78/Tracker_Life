"use client";

import { Capacitor } from "@capacitor/core";
import { Download, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { CALENDAR_EXPORT_URL, createCourse, createDeadline, deleteCourse, deleteDeadline, fetchCourses, renameCourse } from "../api/coursesApi";
import { deadlinesOfCourse, selectUpcomingDeadlines, type CoursesData } from "../domain/courses";
import { CourseCard, type CourseCardActions } from "./CourseCard";
import { COURSES_COPY, type CoursesCopy } from "./coursesCopy";
import { DeadlineRow } from "./DeadlineRow";

export function CoursesView(): React.ReactElement {
  const { locale } = useLocale();
  const copy = COURSES_COPY[locale];
  const [data, setData] = useState<CoursesData | null>(null);
  const [newCourse, setNewCourse] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async (): Promise<void> => {
    try {
      setData(await fetchCourses());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : copy.failed);
    }
  }, [copy.failed]);

  useEffect(() => { void reload(); }, [reload]);

  async function run(action: () => Promise<void>): Promise<void> {
    setError("");
    try {
      await action();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    }
    await reload();
  }

  const actions: CourseCardActions = {
    rename: (course, name) => run(() => renameCourse(course.id, name)),
    remove: (course) => (window.confirm(copy.confirmRemoveCourse) ? run(() => deleteCourse(course.id)) : Promise.resolve()),
    addDeadline: (draft) => run(() => createDeadline(draft)),
    removeDeadline: (deadline) => (window.confirm(copy.confirmRemoveDeadline) ? run(() => deleteDeadline(deadline.id)) : Promise.resolve())
  };

  async function submitCourse(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const name = newCourse.trim();
    if (!name) return;
    setNewCourse("");
    await run(() => createCourse(name));
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">{copy.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{copy.hint}</p>
        </div>
        <CalendarExportButton copy={copy} />
      </header>
      <form onSubmit={(event) => void submitCourse(event)} className="flex flex-col gap-2 rounded-[22px] bg-panel p-2 ring-1 ring-line sm:flex-row">
        <input aria-label={copy.coursePlaceholder} value={newCourse} onChange={(event) => setNewCourse(event.target.value)} placeholder={copy.coursePlaceholder} className="focus-ring min-h-11 min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-base text-ink placeholder:text-muted/70" />
        <PrimaryButton type="submit" disabled={!newCourse.trim()} className="min-h-11"><Plus className="h-4 w-4" />{copy.addCourse}</PrimaryButton>
      </form>
      {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
      {data === null ? <p className="text-sm text-muted">{copy.loading}</p> : <CoursesContent data={data} locale={locale} copy={copy} actions={actions} />}
    </div>
  );
}

function CoursesContent({ data, locale, copy, actions }: { data: CoursesData; locale: string; copy: CoursesCopy; actions: CourseCardActions }): React.ReactElement {
  const coursesById = new Map(data.courses.map((course) => [course.id, course]));
  const upcoming = selectUpcomingDeadlines(data.deadlines, data.today);
  const activeCourses = data.courses.filter((course) => !course.archived);
  return (
    <>
      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-muted">{copy.upcoming}</h2>
        {upcoming.length ? (
          <ul className="grid gap-1.5">
            {upcoming.map((deadline) => {
              const course = deadline.courseId ? coursesById.get(deadline.courseId) ?? null : null;
              return <DeadlineRow key={deadline.id} deadline={deadline} courseName={course?.name ?? null} courseColor={course?.color ?? null} today={data.today} locale={locale} copy={copy} onRemove={() => void actions.removeDeadline(deadline)} />;
            })}
          </ul>
        ) : <p className="text-sm text-muted">{copy.noUpcoming}</p>}
      </section>
      {!activeCourses.length ? <p className="text-sm text-muted">{copy.empty}</p> : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {activeCourses.map((course) => <CourseCard key={course.id} course={course} deadlines={deadlinesOfCourse(data.deadlines, course.id)} today={data.today} locale={locale} copy={copy} actions={actions} />)}
        <CourseCard course={null} deadlines={deadlinesOfCourse(data.deadlines, null)} today={data.today} locale={locale} copy={copy} actions={actions} />
      </ul>
    </>
  );
}

/** Web only: the Android app opens each date in Google Agenda instead (file downloads are not available there). */
function CalendarExportButton({ copy }: { copy: CoursesCopy }): React.ReactElement | null {
  const [isNative, setIsNative] = useState(true);
  useEffect(() => { setIsNative(Capacitor.isNativePlatform()); }, []);
  if (isNative) return null;
  return (
    <div className="grid max-w-xs gap-1">
      <a href={CALENDAR_EXPORT_URL} download="cours-echeances.ics" className="focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-2xl bg-panel2 px-3.5 text-sm font-medium text-ink ring-1 ring-line hover:brightness-105">
        <Download className="h-4 w-4" />{copy.exportAll}
      </a>
      <p className="text-xs text-muted">{copy.exportHint}</p>
    </div>
  );
}
