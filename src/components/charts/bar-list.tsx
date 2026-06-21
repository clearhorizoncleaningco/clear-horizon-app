import { currency0 } from "@/lib/format";
import type { ChartBar } from "@/lib/dashboard/aggregate";

/**
 * Lightweight horizontal bar chart (Phase 3 dashboards/reports). Pure CSS — no
 * charting dependency, consistent with the project's minimal-deps stance. Bars
 * are sized by `metric` (count or dollar value); both figures are shown as text.
 */
export function BarList({
  bars,
  metric = "count",
  emptyLabel = "No data yet.",
}: {
  bars: ChartBar[];
  metric?: "count" | "value";
  emptyLabel?: string;
}) {
  if (bars.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...bars.map((b) => (metric === "value" ? b.value : b.count)));

  return (
    <ul className="flex flex-col gap-2">
      {bars.map((b) => {
        const magnitude = metric === "value" ? b.value : b.count;
        const pct = Math.max(2, Math.round((magnitude / max) * 100));
        return (
          <li key={b.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm" title={b.label}>
              {b.label}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full rounded bg-primary/80" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-32 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {b.count}
              {metric === "value" || b.value > 0 ? <> · {currency0(b.value)}</> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
