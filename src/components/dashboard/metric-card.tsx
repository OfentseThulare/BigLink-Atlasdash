import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  return (
    <article className="metric-card">
      <div className={cn("metric-icon", `metric-icon-${tone}`)}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-note">{note}</p>
    </article>
  );
}
