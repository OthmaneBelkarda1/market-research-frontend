import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/labels";

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        meta.bg,
        meta.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot, meta.active && "dot-pulse")} />
      {meta.label}
    </span>
  );
}
