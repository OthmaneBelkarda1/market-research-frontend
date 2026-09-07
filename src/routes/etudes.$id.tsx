import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Globe, Loader2, RefreshCw, ServerCrash } from "lucide-react";

import { api, conflictStudyId, errorMessage, type SourceRow } from "@/lib/api";
import {
  formatDateTime,
  formatDuration,
  isActiveStatus,
  readPhaseDurations,
  regionFlag,
  regionLabel,
  shortId,
  studyErrorCode,
  studyErrorDisplay,
} from "@/lib/labels";
import { useProductName } from "@/hooks/use-product-names";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/study/status-badge";
import { PageTitle, SectionTitle } from "@/components/heading";
import { ModulesGrid, PhaseTimeline, ProgressOverview } from "@/components/study/progress-panels";
import { ResultsView } from "@/components/study/results-view";
import {
  AliexpressStrip,
  AmazonStrip,
  MetaAdsStrip,
  WebPagesStrip,
} from "@/components/study/source-strips";

export const Route = createFileRoute("/etudes/$id")({
  head: () => ({
    meta: [
      { title: "Suivi d'étude — Études de Marché IA" },
      {
        name: "description",
        content:
          "Suivez la collecte multi-sources et les analyses IA d'une étude de marché e-commerce.",
      },
      { property: "og:title", content: "Suivi d'étude — Études de Marché IA" },
      {
        property: "og:description",
        content: "Progression, sources collectées et résultats d'une étude de marché.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

function StudyPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [relaunching, setRelaunching] = useState(false);

  const studyQuery = useQuery({
    queryKey: ["study", id],
    queryFn: () => api.getStudy(id),
    refetchInterval: (query) => (isActiveStatus(query.state.data?.status) ? 6000 : false),
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15000),
  });

  const study = studyQuery.data;
  const active = isActiveStatus(study?.status);

  const sourcesQuery = useQuery({
    queryKey: ["sources", id],
    queryFn: () => api.getSources(id),
    enabled: Boolean(study),
    refetchInterval: active ? 12_000 : false,
    retry: 2,
  });

  const cached = useProductName(study?.product_id);
  const productName =
    study?.product_name ?? study?.product?.name ?? cached?.name ?? shortId(study?.id ?? id);

  // Sans nom de produit, le titre affiche déjà la référence courte : la
  // surtitrer avec la même chaîne la ferait lire deux fois.
  const reference = shortId(study?.id ?? id);
  const eyebrow = productName === reference ? "Étude de marché" : `Étude ${reference}`;

  // Territoire sans devise propre : l'étude s'arrête avant toute collecte.
  const devisePasCouverte = studyErrorCode(study?.error) === "CURRENCY_NOT_MAPPED";
  const phase = readPhaseDurations(study?.progress ?? null);
  const sources: SourceRow[] = sourcesQuery.data?.items ?? [];

  useEffect(() => {
    if (!active) queryClient.invalidateQueries({ queryKey: ["studies", "sidebar"] });
  }, [active, queryClient]);

  async function relaunch() {
    if (!study) return;
    setRelaunching(true);
    try {
      const created = await api.createStudy({
        product_id: study.product_id,
        region: study.region,
      });
      toast.success("Nouvelle étude lancée.");
      queryClient.invalidateQueries({ queryKey: ["studies", "sidebar"] });
      navigate({ to: "/etudes/$id", params: { id: created.id } });
    } catch (e) {
      const conflict = conflictStudyId(e);
      if (conflict) {
        toast.info("Une étude est déjà en cours pour ce produit et cette région.");
        navigate({ to: "/etudes/$id", params: { id: conflict } });
      } else {
        toast.error(errorMessage(e, "Impossible de relancer l'étude."));
      }
    } finally {
      setRelaunching(false);
    }
  }

  if (studyQuery.isLoading) {
    return (
      <div className="space-y-4 pt-8">
        <Skeleton className="h-9 w-72 rounded-xl" />
        <Skeleton className="h-6 w-52 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (studyQuery.isError || !study) {
    return (
      <div className="pt-10">
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <ServerCrash className="mx-auto size-6 text-muted-foreground" />
          <h1 className="title-display mt-3 text-lg">Étude indisponible</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {errorMessage(studyQuery.error)} Le serveur se réveille peut-être, nouvelle tentative en
            cours…
          </p>
          <Button variant="outline" className="mt-4" onClick={() => studyQuery.refetch()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 pt-6">
      {studyQuery.isRefetching && studyQuery.isError ? (
        <div className="rounded-xl bg-warning-soft px-4 py-2 text-xs text-warning">
          Le serveur se réveille, nouvelle tentative…
        </div>
      ) : null}

      <div className="space-y-3">
        <PageTitle
          eyebrow={eyebrow}
          actions={
            <Button
              variant="outline"
              onClick={relaunch}
              disabled={relaunching}
              className="gap-2 rounded-xl"
            >
              {relaunching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Relancer l'étude
            </Button>
          }
        >
          {productName}
        </PageTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={study.status} />
          <span
            className="rounded-full border border-border bg-surface px-2 py-1"
            title={regionLabel(study.region)}
          >
            {regionFlag(study.region)} {regionLabel(study.region) || study.region}
          </span>
          {study.langue ? (
            <span className="rounded-full border border-border bg-surface px-2 py-1">
              {study.langue}
            </span>
          ) : null}
          {study.devise ? (
            <span className="rounded-full border border-border bg-surface px-2 py-1">
              {study.devise}
            </span>
          ) : null}
          {formatDateTime(study.started_at) ? (
            <span>Début : {formatDateTime(study.started_at)}</span>
          ) : null}
          {formatDateTime(study.finished_at) ? (
            <span>Fin : {formatDateTime(study.finished_at)}</span>
          ) : null}
          {phase.total ? <span>Durée : {formatDuration(phase.total)}</span> : null}
        </div>
      </div>

      {active ? (
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
            <PhaseTimeline status={study.status} />
            <ProgressOverview progress={study.progress ?? null} />
          </section>
          <ModulesGrid progress={study.progress ?? null} />
          {sources.length > 0 ? (
            <div className="space-y-8 pt-2">
              {sources.some((s) => s.source === "aliexpress") ? (
                <AliexpressStrip
                  studyId={study.id}
                  row={sources.find((s) => s.source === "aliexpress")}
                />
              ) : null}
              {sources.some((s) => s.source === "amazon") ? (
                <AmazonStrip studyId={study.id} row={sources.find((s) => s.source === "amazon")} />
              ) : null}
              {sources.some((s) => s.source === "meta_ads") ? (
                <MetaAdsStrip
                  studyId={study.id}
                  row={sources.find((s) => s.source === "meta_ads")}
                />
              ) : null}
              {sources.some((s) => s.source === "recherche_web") ? (
                <WebPagesStrip
                  studyId={study.id}
                  row={sources.find((s) => s.source === "recherche_web")}
                />
              ) : null}
            </div>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            Actualisation automatique toutes les 6 secondes.
          </p>
        </div>
      ) : null}

      {study.status === "failed" ? (
        <section className="rounded-2xl border border-danger/30 bg-danger-soft p-5">
          <SectionTitle icon={AlertTriangle} tone="danger" size="sm">
            {devisePasCouverte ? "Pays non chiffrable" : "L'étude a échoué"}
          </SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            {studyErrorDisplay(study.error) ??
              "Aucun détail d'erreur n'a été renvoyé par le serveur."}
          </p>
          {/* Relancer à l'identique rejouerait le même échec : seul un autre pays change quelque chose. */}
          {devisePasCouverte ? (
            <Button
              variant="outline"
              className="mt-4 gap-2 rounded-xl"
              onClick={() => navigate({ to: "/" })}
            >
              <Globe className="size-4" />
              Choisir un autre pays
            </Button>
          ) : (
            <Button variant="outline" className="mt-4 gap-2 rounded-xl" onClick={relaunch}>
              <RefreshCw className="size-4" />
              Relancer l'étude
            </Button>
          )}
        </section>
      ) : null}

      {study.status === "completed" || study.status === "partial" ? (
        <div className="space-y-6">
          {study.status === "partial" ? (
            <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              Étude partielle : certaines sources ou analyses ont échoué.
            </div>
          ) : null}
          <ResultsView study={study} sources={sources} />
        </div>
      ) : null}
    </div>
  );
}
