"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Metric } from "@/components/ui";
import { loadPerformance } from "../api/performanceApi";
import { formatCapital, formatWorkTime, type PerformanceData } from "../domain/performance";

export function PerformanceStrip({ refreshKey }: { refreshKey?: object }) {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let controller: AbortController | null = null;
    function refresh() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      void loadPerformance(request.signal).then((result) => {
        if (!request.signal.aborted) { setPerformance(result); setError(""); }
      }).catch(() => { if (!request.signal.aborted) setError("Performance unavailable. Open the performance page to retry."); });
    }
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("performance-updated", refresh);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("performance-updated", refresh); };
  }, [refreshKey]);

  return <Card>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-ink">Performance <span className="ml-2 font-normal text-muted">{performance?.status}</span></h2>
      <Link href="/performance" className="focus-ring rounded-lg text-sm font-medium text-accent">Performance & rewards →</Link>
    </div>
    {error ? <p role="status" className="text-sm text-muted">{error}</p> : performance ? <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Performance index" value={`${performance.index} / 100`} detail="Current week · to date" />
      <Metric label="Weekly target" value={`${formatWorkTime(performance.week.minutes)} / ${Math.round(performance.targetMinutes / 60)}h`} detail={`${formatWorkTime(performance.remainingMinutes)} remaining`} />
      <Metric label="Capital generated" value={formatCapital(performance.week.capitalCents)} detail="This week · fictional value" />
      <Metric label="Productive streak" value={`${performance.streak} days`} detail={`${performance.week.tasks} tasks · ${performance.week.objectives} objectives this week`} />
    </div> : <p role="status" className="text-sm text-muted">Loading performance…</p>}
  </Card>;
}
