import type { SourceRow, Study } from "@/lib/api";
import { SectionTitle } from "@/components/heading";
import { ANALYSES } from "@/lib/labels";
import { ModuleCard } from "./progress-panels";
import { CollectionDetails } from "./collection-details";
import { ReportView } from "./report-view";
import { AliexpressStrip, AmazonStrip, MetaAdsStrip, WebPagesStrip } from "./source-strips";

export function ResultsView({ study, sources }: { study: Study; sources: SourceRow[] }) {
  const row = (key: string) => sources.find((s) => s.source === key);

  return (
    <div className="space-y-10">
      <ReportView studyId={study.id} />

      <div className="space-y-8">
        <AliexpressStrip studyId={study.id} row={row("aliexpress")} />
        <AmazonStrip studyId={study.id} row={row("amazon")} />
        <MetaAdsStrip studyId={study.id} row={row("meta_ads")} />
        <WebPagesStrip studyId={study.id} row={row("recherche_web")} />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <SectionTitle as="h3" size="sm" className="mb-3">
          Analyses réalisées
        </SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {ANALYSES.map((m) => (
            <ModuleCard
              key={m.key}
              label={m.label}
              moduleKey={m.key}
              progress={study.progress ?? null}
            />
          ))}
        </div>
      </section>

      <CollectionDetails studyId={study.id} sources={sources} />
    </div>
  );
}
