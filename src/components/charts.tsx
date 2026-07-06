"use client";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const palette = ["#d9ff2f", "#7ec8e3", "#111a20", "#ffcf65", "#ef767a", "#7d8cc4"];

export function BarList({
  data,
  compact = false,
}: {
  data: Record<string, number>;
  compact?: boolean;
}) {
  const entries = Object.entries(data).filter(([, value]) => value > 0);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  if (!entries.length) {
    return <p className="text-sm text-muted">No report data yet.</p>;
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {entries.map(([label, value], index) => (
        <div key={label} className="grid grid-cols-[minmax(86px,1fr)_3fr_auto] items-center gap-3">
          <span className="truncate text-xs font-semibold text-muted">{label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#e8f0f4]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((value / max) * 100, 8)}%`,
                backgroundColor: palette[index % palette.length],
              }}
            />
          </div>
          <span className="font-mono text-xs font-bold text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (!entries.length || total === 0) {
    return <p className="text-sm text-muted">No chart data yet.</p>;
  }

  let cursor = 0;
  const gradient = entries
    .map(([, value], index) => {
      const start = cursor;
      const end = cursor + (value / total) * 100;
      cursor = end;
      return `${palette[index % palette.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div
        className="grid h-36 w-36 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <span className="font-mono text-2xl font-bold">{total}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([label, value], index) => (
          <Badge key={label} tone="neutral" className="gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            {label}: {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-16 items-end gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="flex-1 rounded-t-lg bg-accent"
          style={{ height: `${Math.max((value / max) * 100, 12)}%` }}
        />
      ))}
    </div>
  );
}
