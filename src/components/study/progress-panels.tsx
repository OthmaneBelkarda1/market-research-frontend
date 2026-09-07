import { Check, CircleSlash, Loader2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_MODULES,
  ANALYSES,
  COLLECTORS,
  formatDuration,
  phaseOfStatus,
  readModule,
  type ModuleState,
} from "@/lib/labels";

function StateIcon({ state }: { state: ModuleState }) {
  if (state === "done") return <Check className="size-3.5 text-success" />;
  // Le module a tourné mais n'a rien rapporté : terminé, sans être un succès.
  if (state === "empty") return <CircleSlash className="size-3.5 text-muted-foreground" />;
  if (state === "running") return <Loader2 className="size-3.5 animate-spin text-primary" />;
  if (state === "failed") return <X className="size-3.5 text-danger" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

export function ModuleCard({
  label,
  progress,
  moduleKey,
}: {
  label: string;
  moduleKey: string;
  progress: Record<string, unknown> | null | undefined;
}) {
  const { state, duration } = readModule(progress, moduleKey);
  const d = formatDuration(duration);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5",
        state === "running" && "border-primary/40 bg-accent/50",
      )}
    >
      <StateIcon state={state} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
      {d && (state === "done" || state === "empty") ? (
        <span className="text-[11px] text-muted-foreground">{d}</span>
      ) : null}
    </div>
  );
}

export function PhaseTimeline({ status }: { status?: string | null }) {
  const current = phaseOfStatus(status);
  const phases = ["Collecte", "Analyse", "Rapport"];
  return (
    <ol className="flex items-center gap-2">
      {phases.map((p, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <li key={p} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
                done && "border-success/30 bg-success-soft text-success",
                active && "border-primary/40 bg-accent text-primary",
                !done && !active && "border-border bg-surface text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  done ? "bg-success" : active ? "bg-primary dot-pulse" : "bg-muted-foreground/50",
                )}
              />
              {p}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ProgressOverview({
  progress,
}: {
  progress: Record<string, unknown> | null | undefined;
}) {
  // Un module vide a terminé : le compter ailleurs figerait la barre à jamais.
  const done = ALL_MODULES.filter((m) =>
    ["done", "empty"].includes(readModule(progress, m.key).state),
  ).length;
  const pct = Math.round((done / ALL_MODULES.length) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Progression globale</span>
        <span className="font-medium text-foreground">
          {done} / {ALL_MODULES.length} modules
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ModulesGrid({
  progress,
}: {
  progress: Record<string, unknown> | null | undefined;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Collecteurs
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTORS.map((m) => (
            <ModuleCard key={m.key} label={m.label} moduleKey={m.key} progress={progress} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Analyses
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYSES.map((m) => (
            <ModuleCard key={m.key} label={m.label} moduleKey={m.key} progress={progress} />
          ))}
        </div>
      </div>
    </div>
  );
}
