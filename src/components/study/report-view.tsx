import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileJson, FileText, Info, Loader2 } from "lucide-react";

import { ApiError, api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/heading";
import { Markdown } from "./markdown";
import { JsonModal } from "./json-modal";
import { VERDICT_META, verdictFromReport } from "@/lib/verdict";
import { cacheVerdict } from "@/lib/verdict-cache";
import { cacheProduct, getCachedProduct, productNameFromReport } from "@/lib/product-cache";

/**
 * Marqueur de tête du gabarit v2 du rapport F7.
 *
 * Sa présence signifie que `resume_markdown` est **la copie exacte du premier écran
 * du rapport**, et non plus un condensé distinct comme dans le gabarit précédent.
 * Afficher les deux ferait lire au visiteur la décision, ses justifications et ses
 * conditions deux fois de suite — soit exactement la duplication que le gabarit v2
 * a supprimée à l'intérieur du document.
 *
 * Le résumé reste produit et servi par l'API : il est le livrable d'une page, et
 * `GET /studies/{id}/report` continue de le porter. Seul son doublon à l'écran
 * disparaît.
 */
const MARQUEUR_GABARIT_V2 = "<!-- f7:v2 -->";

export function ReportView({ studyId, productId }: { studyId: string; productId?: string | null }) {
  const [jsonOpen, setJsonOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["report", studyId],
    queryFn: () => api.getReport(studyId),
    // Un 404 signifie « F7 n'a pas encore écrit de rapport » : ce n'est pas une panne,
    // réessayer ne changerait rien.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
    staleTime: 5 * 60_000,
  });

  const verdict = useMemo(
    () => (reportQuery.data ? verdictFromReport(reportQuery.data) : null),
    [reportQuery.data],
  );

  // Le rapport ouvert est la source la plus fiable du verdict : on en profite pour
  // renseigner le cache que la liste latérale interroge pour son regroupement.
  useEffect(() => {
    if (verdict) cacheVerdict(studyId, verdict);
  }, [verdict, studyId]);

  const productName = useMemo(
    () => (reportQuery.data ? productNameFromReport(reportQuery.data) : null),
    [reportQuery.data],
  );

  // Même raison pour le nom du produit : aucun endpoint ne le sert, et le titre
  // de la page comme la liste latérale retombent sinon sur l'identifiant court.
  // On ne réécrit que sur changement, sinon chaque montage rediffuserait
  // `product-cache-updated` sans que rien n'ait bougé.
  useEffect(() => {
    if (!productId || !productName) return;
    if (getCachedProduct(productId)?.name === productName) return;
    cacheProduct(productId, { name: productName });
  }, [productName, productId]);

  const download = () => {
    const report = reportQuery.data;
    if (!report) return;
    const blob = new Blob([report.rapport_markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_${studyId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (reportQuery.isLoading) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <Skeleton className="h-6 w-56 rounded-lg" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-11/12 rounded" />
        <Skeleton className="h-4 w-9/12 rounded" />
      </section>
    );
  }

  if (reportQuery.isError) {
    const notFound = reportQuery.error instanceof ApiError && reportQuery.error.status === 404;
    return (
      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-px size-4 shrink-0" />
          {notFound
            ? "Aucun rapport n'a encore été produit pour cette étude."
            : `Rapport indisponible. ${errorMessage(reportQuery.error)}`}
        </p>
        {!notFound ? (
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => reportQuery.refetch()}
          >
            Réessayer
          </Button>
        ) : null}
      </section>
    );
  }

  const report = reportQuery.data;
  if (!report) return null;

  // Le gabarit v1 produisait un résumé distinct du corps du rapport : il garde donc
  // sa carte. Le v2 fait des deux le même texte.
  const resumeDistinctDuRapport =
    Boolean(report.resume_markdown) && !report.rapport_markdown.includes(MARQUEUR_GABARIT_V2);

  return (
    <section className="space-y-5">
      <SectionTitle
        icon={FileText}
        aside={
          <>
            {/* La décision se lit à la couleur dès l'en-tête, sans dérouler le rapport. */}
            {verdict ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  VERDICT_META[verdict].bg,
                  VERDICT_META[verdict].text,
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", VERDICT_META[verdict].dot)}
                  aria-hidden
                />
                {VERDICT_META[verdict].label}
              </span>
            ) : null}
            {report.payload ? (
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => setJsonOpen(true)}
              >
                <FileJson className="size-4" />
                JSON F7
              </Button>
            ) : null}
            <Button variant="outline" className="gap-2 rounded-xl" onClick={download}>
              {reportQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Télécharger (.md)
            </Button>
          </>
        }
      >
        Rapport final
      </SectionTitle>

      {resumeDistinctDuRapport ? (
        <div className="rounded-2xl border border-primary/25 bg-accent/50 p-5">
          <SectionTitle as="h3" size="sm" tone="accent" className="mb-2">
            Résumé exécutif
          </SectionTitle>
          <Markdown source={report.resume_markdown ?? ""} />
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
        <Markdown source={report.rapport_markdown} />
      </div>

      <JsonModal
        open={jsonOpen}
        onOpenChange={setJsonOpen}
        title="Rapport F7"
        payload={report.payload}
      />
    </section>
  );
}
