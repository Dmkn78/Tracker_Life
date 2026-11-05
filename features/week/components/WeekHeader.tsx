"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProgressBar, SecondaryButton } from "@/components/ui";
import { getIsoWeekId } from "@/lib/dates";
import type { WeekBoard } from "../domain/weekBoard";
import { formatWeekRange } from "./dayLabels";
import type { WeekCopy } from "./weekCopy";

export function WeekHeader({ board, eyebrow, locale, copy, onShowWeek, children }: {
  board: WeekBoard;
  eyebrow: string;
  locale: string;
  copy: WeekCopy;
  onShowWeek: (weekId: string) => void;
  children?: React.ReactNode;
}): React.ReactElement {
  const currentWeekId = getIsoWeekId(board.today);
  const progressPercent = Math.round(board.summary.completionRate * 100);
  const progressLabel = copy.progress.replace("{done}", String(board.summary.done)).replace("{planned}", String(board.summary.planned));
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase text-accent">{eyebrow} · {board.weekId}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">{formatWeekRange(board.days[0].date, board.days[6].date, locale)}</h1>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar value={progressPercent} className="w-40" />
          <span className="text-sm text-muted">{progressLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <SecondaryButton type="button" aria-label={copy.previousWeek} onClick={() => onShowWeek(board.previousWeekId)}><ChevronLeft className="h-4 w-4" /></SecondaryButton>
        {board.weekId !== currentWeekId ? <SecondaryButton type="button" onClick={() => onShowWeek(currentWeekId)}>{copy.thisWeek}</SecondaryButton> : null}
        <SecondaryButton type="button" aria-label={copy.nextWeek} onClick={() => onShowWeek(board.nextWeekId)}><ChevronRight className="h-4 w-4" /></SecondaryButton>
      </div>
    </header>
  );
}
