import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Plus, Search, AlertCircle, Loader2 } from "lucide-react";

import { api, errorMessage, type Study } from "@/lib/api";
import {
  dateGroup,
  isActiveStatus,
  regionLabel,
  relativeTime,
  shortId,
  statusMeta,
} from "@/lib/labels";
import { VERDICT_META, VERDICT_ORDER, type VerdictKey } from "@/lib/verdict";
import { useProductNames } from "@/hooks/use-product-names";
import { useStudyVerdicts } from "@/hooks/use-study-verdicts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "En cours" },
  { key: "done", label: "Terminées" },
  { key: "failed", label: "Échouées" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const GROUPINGS = [
  { key: "verdict", label: "Verdict" },
  { key: "date", label: "Date" },
] as const;

type GroupKey = (typeof GROUPINGS)[number]["key"];

interface Section {
  id: string;
  title: string;
  dot?: string;
  items: Study[];
}

function matchesFilter(study: Study, filter: FilterKey) {
  switch (filter) {
    case "active":
      return isActiveStatus(study.status);
    case "done":
      return study.status === "completed" || study.status === "partial";
    case "failed":
      return study.status === "failed";
    default:
      return true;
  }
}

export function SidebarContentPanel({ onNavigate }: { onNavigate?: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [groupBy, setGroupBy] = useState<GroupKey>("verdict");
  const productNames = useProductNames();
  const params = useParams({ strict: false }) as { id?: string };
  const activeId = params.id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["studies", "sidebar"],
    queryFn: () => api.listStudies({ limit: 50 }),
    refetchInterval: 30_000,
    retry: 3,
  });

  const studies = useMemo(() => data?.items ?? [], [data]);
  const verdicts = useStudyVerdicts(studies);

  const studyLabel = (s: Study) =>
    s.product_name ?? s.product?.name ?? productNames[s.product_id]?.name ?? shortId(s.id);

  const { sections, count } = useMemo(() => {
    const items = studies
      .filter((s) => matchesFilter(s, filter))
      .filter((s) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          studyLabel(s).toLowerCase().includes(q) ||
          (s.region ?? "").toLowerCase().includes(q) ||
          regionLabel(s.region).toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      );

    if (groupBy === "date") {
      const sections: Section[] = [
        {
          id: "today",
          title: "Aujourd'hui",
          items: items.filter((s) => dateGroup(s.created_at) === "today"),
        },
        {
          id: "week",
          title: "7 derniers jours",
          items: items.filter((s) => dateGroup(s.created_at) === "week"),
        },
        {
          id: "older",
          title: "Plus ancien",
          items: items.filter((s) => dateGroup(s.created_at) === "older"),
        },
      ];
      return { sections, count: items.length };
    }

    // Chaque étude figure dans un et un seul groupe : les verdicts connus dans le
    // leur, tout le reste (en cours, échouée, rapport sans verdict lisible) dans
    // le groupe de fin, pour qu'aucune étude ne disparaisse de la liste.
    const sections: Section[] = VERDICT_ORDER.map((key) => ({
      id: key,
      title: VERDICT_META[key].group,
      dot: VERDICT_META[key].dot,
      items: items.filter((s) => verdicts.map[s.id] === key),
    }));
    sections.push({
      id: "none",
      title: "Sans verdict",
      dot: "bg-muted-foreground/40",
      items: items.filter((s) => !verdicts.map[s.id]),
    });

    return { sections, count: items.length };
  }, [studies, filter, search, productNames, groupBy, verdicts]);

  const renderSection = (section: Section) => {
    if (!section.items.length) return null;
    return (
      <div key={section.id} className="mb-5">
        <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {section.dot ? (
            <span className={cn("size-1.5 shrink-0 rounded-full", section.dot)} aria-hidden />
          ) : null}
          <span>{section.title}</span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
            {section.items.length}
          </span>
          {section.id === "none" && verdicts.pending > 0 ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground/70" aria-hidden />
          ) : null}
        </p>
        <ul className="space-y-0.5">
          {section.items.map((s) => {
            const meta = statusMeta(s.status);
            const cached = productNames[s.product_id];
            const verdict: VerdictKey | undefined = verdicts.map[s.id];
            return (
              <li key={s.id}>
                <Link
                  to="/etudes/$id"
                  params={{ id: s.id }}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent/70",
                    activeId === s.id && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      meta.dot,
                      meta.active && "dot-pulse",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {s.product_name ?? s.product?.name ?? cached?.name ?? shortId(s.id)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="rounded border border-border bg-surface px-1 py-px font-medium">
                        {s.region}
                      </span>
                      {/* Groupée par verdict, la liste le dit déjà dans son titre. */}
                      {groupBy === "date" && verdict ? (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1 py-px font-medium",
                            VERDICT_META[verdict].bg,
                            VERDICT_META[verdict].text,
                          )}
                        >
                          {VERDICT_META[verdict].label}
                        </span>
                      ) : null}
                      <span className="truncate">{relativeTime(s.created_at)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="size-4.5" />
        </span>
        <span className="font-serif text-[15px] font-semibold">Études de Marché</span>
      </div>

      <div className="px-3">
        <Button asChild className="w-full justify-start gap-2 rounded-xl shadow-none">
          <Link to="/" onClick={onNavigate}>
            <Plus className="size-4" />
            Nouvelle étude
          </Link>
        </Button>
      </div>

      <div className="space-y-2 px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une étude"
            className="h-9 rounded-lg border-border bg-surface pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Grouper par</span>
          <span className="flex items-center gap-0.5 rounded-full bg-surface p-0.5">
            {GROUPINGS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroupBy(g.key)}
                aria-pressed={groupBy === g.key}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                  groupBy === g.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 no-scrollbar">
        {isLoading && (
          <div className="space-y-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface p-3 text-xs text-muted-foreground">
            <AlertCircle className="mt-px size-3.5 shrink-0 text-danger" />
            <span>Liste indisponible. {errorMessage(error)} Le serveur se réveille peut-être…</span>
          </div>
        )}

        {!isLoading && !isError && count === 0 && (
          <p className="px-2 pt-3 text-xs leading-relaxed text-muted-foreground">
            Aucune étude pour l'instant. Lancez votre première étude de marché.
          </p>
        )}

        {sections.map(renderSection)}
      </div>
    </div>
  );
}
