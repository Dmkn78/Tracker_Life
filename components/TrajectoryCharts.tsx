"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Panel } from "@/components/ui";

type Point = {
  date: string;
  stateScore: number | null;
  riskScore: number | null;
  executionScore: number | null;
  startFriction: number | null;
  productivity: number | null;
  energy: number | null;
  caloriePercent: number | null;
};

const chartDefs = [
  { key: "stateScore", label: "State Score", color: "#34d399" },
  { key: "riskScore", label: "Risk Score", color: "#fbbf24" },
  { key: "executionScore", label: "Execution Score", color: "#22d3ee" },
  { key: "startFriction", label: "Start Friction", color: "#fb7185" },
  { key: "productivity", label: "Productivity", color: "#38bdf8" },
  { key: "energy", label: "Energy", color: "#8b5cf6" },
  { key: "caloriePercent", label: "Calories %", color: "#c084fc", domain: [50, 150] as [number, number] }
];

export function TrajectoryCharts({ data, compact = false }: { data: Point[]; compact?: boolean }) {
  const defs = compact ? chartDefs.slice(0, 2) : chartDefs;
  return (
    <div className={compact ? "grid gap-3" : "grid gap-4 lg:grid-cols-2"}>
      {defs.map((def) => (
        <Panel key={def.key} className={compact ? "p-3" : ""}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">{def.label}</h2>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: def.color }} />
          </div>
          <div className={compact ? "h-28" : "h-56"}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#263349" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={def.domain ?? [0, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #263349",
                    borderRadius: 8,
                    color: "#f8fafc"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={def.key}
                  stroke={def.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ))}
    </div>
  );
}
