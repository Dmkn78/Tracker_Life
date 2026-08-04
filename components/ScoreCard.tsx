import { Card, Metric } from "@/components/ui";

export function ScoreCard({
  executionScore,
  stateScore,
  riskScore,
  riskDelta,
  riskAcceleration,
  context
}: {
  executionScore?: number | null;
  stateScore?: number | null;
  riskScore?: number | null;
  riskDelta?: number | null;
  riskAcceleration?: number | null;
  context?: string;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Day Status</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Computed signal</h2>
        </div>
        {context ? (
          <span className="rounded-md border border-line bg-shell px-2 py-1 text-xs font-semibold text-muted">
            {context.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Execution" value={String(executionScore ?? "--")} />
        <Metric label="State" value={String(stateScore ?? "--")} tone="good" />
        <Metric label="Risk" value={String(riskScore ?? "--")} tone="warn" />
        <Metric label="Delta" value={String(riskDelta ?? "--")} />
        <Metric label="Acceleration" value={String(riskAcceleration ?? "--")} tone="risk" />
      </div>
    </Card>
  );
}
