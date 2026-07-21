import { cn } from "@/lib/utils";

const tones = {
  credit: "border-positive/25 bg-positive-soft text-positive-strong",
  debit: "border-negative/25 bg-negative-soft text-negative-strong",
  pending: "border-warning/25 bg-warning-soft text-warning-strong",
  disputed: "border-ink/15 bg-neutral-100 text-neutral-700",
};

export function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: keyof typeof tones;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
