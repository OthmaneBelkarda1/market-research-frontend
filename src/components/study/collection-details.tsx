import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileJson } from "lucide-react";

import { api, type SourceRow } from "@/lib/api";
import { COLLECTORS, SOURCE_STATUS_LABEL, formatDuration } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/heading";
import { JsonModal } from "./json-modal";

function sourceLabel(key: string) {
  return COLLECTORS.find((c) => c.key === key)?.label ?? key;
}

function statusClass(status: string) {
  if (status === "succeeded") return "bg-success-soft text-success";
  if (status === "failed") return "bg-danger-soft text-danger";
  if (status === "empty") return "bg-warning-soft text-warning";
  return "bg-muted text-muted-foreground";
}

function JsonButton({ studyId, source }: { studyId: string; source: string }) {
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useQuery({
    queryKey: ["source", studyId, source],
    queryFn: () => api.getSource(studyId, source),
    enabled: open,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px]"
        onClick={() => setOpen(true)}
      >
        <FileJson className="size-3.5" />
        JSON brut
      </Button>
      <JsonModal
        open={open}
        onOpenChange={setOpen}
        title={sourceLabel(source)}
        payload={isFetching && !data ? "Chargement…" : data?.payload}
      />
    </>
  );
}

export function CollectionDetails({ studyId, sources }: { studyId: string; sources: SourceRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <SectionTitle as="span" size="sm">
          Détail de la collecte
        </SectionTitle>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-2 py-2">
          {sources.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Aucune source enregistrée pour le moment.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Durée</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t border-border/70 align-top">
                    <td className="px-3 py-2.5 font-medium">{sourceLabel(s.source)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                          statusClass(s.status),
                        )}
                      >
                        {SOURCE_STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      {s.error ? (
                        <p className="mt-1 max-w-md text-[11px] leading-snug text-danger">
                          {s.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDuration(s.duration_seconds) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <JsonButton studyId={studyId} source={s.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </section>
  );
}
