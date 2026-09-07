import { useQuery } from "@tanstack/react-query";
import { Play, Facebook, Instagram } from "lucide-react";

import { api, type SourceRow } from "@/lib/api";
import { formatNumber } from "@/lib/labels";
import { MoreChip, Strip, StripCard, StripImage, StripNotice, StripSkeletons } from "./strip";

const MAX_ITEMS = 12;

function useSourcePayload(studyId: string, source: string, enabled: boolean) {
  return useQuery({
    queryKey: ["source", studyId, source],
    queryFn: () => api.getSource(studyId, source),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 2,
  });
}

function asArray(payload: unknown, key: string): Record<string, any>[] {
  if (!payload || typeof payload !== "object") return [];
  const arr = (payload as Record<string, unknown>)[key];
  return Array.isArray(arr) ? (arr.filter((x) => x && typeof x === "object") as any[]) : [];
}

function StripShell({
  studyId,
  source,
  title,
  row,
  render,
}: {
  studyId: string;
  source: string;
  title: string;
  row?: SourceRow | undefined;
  render: (payload: unknown) => { cards: React.ReactNode[]; total: number };
}) {
  const status = row?.status;
  const enabled = status === "succeeded" || status === undefined;
  const { data, isLoading, isError } = useSourcePayload(studyId, source, enabled);

  if (status === "failed") {
    return <StripNotice title={title} message="Source indisponible" />;
  }
  if (status === "skipped_region") {
    return <StripNotice title={title} message="Source non couverte pour cette région" />;
  }
  // `empty` : le collecteur a tourné et n'a rien trouvé. Aller chercher le payload
  // ne ramènerait rien de plus, et l'absence de résultat n'est pas une panne.
  if (status === "empty") {
    return <StripNotice title={title} message="Aucun résultat pour ce produit" />;
  }

  if (isLoading) {
    return (
      <Strip title={title}>
        <StripSkeletons />
      </Strip>
    );
  }

  if (isError || !data) {
    return <StripNotice title={title} message="Données non disponibles pour le moment" />;
  }

  const { cards, total } = render(data.payload);
  if (!cards.length) {
    return <StripNotice title={title} message="Aucun élément collecté" />;
  }

  return (
    <Strip
      title={title}
      subtitle={`${formatNumber(total)} élément${total > 1 ? "s" : ""}`}
      extra={<MoreChip count={Math.max(0, total - cards.length)} />}
    >
      {cards}
    </Strip>
  );
}

export function AliexpressStrip({
  studyId,
  row,
}: {
  studyId: string;
  row?: SourceRow | undefined;
}) {
  return (
    <StripShell
      studyId={studyId}
      source="aliexpress"
      title="Produits AliExpress"
      row={row}
      render={(payload) => {
        const items = asArray(payload, "produits");
        const cards = items.slice(0, MAX_ITEMS).map((p, i) => {
          const prix =
            p["prix_formate"] ?? [p["prix_vente"], p["devise"]].filter(Boolean).join(" ") ?? null;
          const remise =
            typeof p["remise_pourcentage"] === "number"
              ? Math.round(p["remise_pourcentage"])
              : null;
          return (
            <StripCard key={i} href={p["url_produit"]}>
              <StripImage
                src={p["image"]}
                alt={p["titre"] ?? "Produit AliExpress"}
                fallbackLabel={p["titre"] ?? "A"}
              />
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2-fix min-h-[2.4rem] text-xs leading-snug">
                  {p["titre"] ?? "Sans titre"}
                </p>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  {prix ? <span className="text-sm font-semibold text-primary">{prix}</span> : null}
                  {p["prix_original"] ? (
                    <span className="text-[11px] text-muted-foreground line-through">
                      {p["prix_original"]}
                    </span>
                  ) : null}
                  {remise ? (
                    <span className="rounded bg-danger-soft px-1 py-px text-[10px] font-medium text-danger">
                      -{remise} %
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {p["note"] ? `★ ${p["note"]}` : ""}
                  {p["note"] && p["nb_commandes"] ? " · " : ""}
                  {p["nb_commandes"] ? `${p["nb_commandes"]} commandes` : ""}
                </p>
              </div>
            </StripCard>
          );
        });
        return { cards, total: items.length };
      }}
    />
  );
}

export function AmazonStrip({ studyId, row }: { studyId: string; row?: SourceRow | undefined }) {
  return (
    <StripShell
      studyId={studyId}
      source="amazon"
      title="Produits Amazon"
      row={row}
      render={(payload) => {
        const items = asArray(payload, "produits");
        const cards = items.slice(0, MAX_ITEMS).map((p, i) => (
          <StripCard key={i} href={p["url"]}>
            <StripImage
              src={p["image"]}
              alt={p["titre"] ?? "Produit Amazon"}
              fallbackLabel={p["titre"] ?? "A"}
            />
            <div className="space-y-1.5 p-3">
              <p className="line-clamp-2-fix min-h-[2.4rem] text-xs leading-snug">
                {p["titre"] ?? "Sans titre"}
              </p>
              <div className="flex flex-wrap items-baseline gap-1.5">
                {p["prix"] ? (
                  <span className="text-sm font-semibold text-primary">
                    {p["prix"]} {p["devise"] ?? ""}
                  </span>
                ) : null}
                {p["prix_barre"] ? (
                  <span className="text-[11px] text-muted-foreground line-through">
                    {p["prix_barre"]}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {p["note"] ? `★ ${p["note"]}` : ""}
                {p["nb_avis"] ? ` (${p["nb_avis"]} avis)` : ""}
              </p>
              {p["marque"] ? (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {p["marque"]}
                </p>
              ) : null}
            </div>
          </StripCard>
        ));
        return { cards, total: items.length };
      }}
    />
  );
}

export function MetaAdsStrip({ studyId, row }: { studyId: string; row?: SourceRow | undefined }) {
  return (
    <StripShell
      studyId={studyId}
      source="meta_ads"
      title="Annonces Meta"
      row={row}
      render={(payload) => {
        const items = asArray(payload, "annonces");
        const cards = items.slice(0, MAX_ITEMS).map((a, i) => {
          const plateformes: string[] = Array.isArray(a["plateformes"]) ? a["plateformes"] : [];
          return (
            <StripCard key={i} href={a["url_bibliotheque"]}>
              {a["image"] ? (
                <StripImage
                  src={a["image"]}
                  alt={a["titre"] ?? "Annonce"}
                  fallbackLabel={a["annonceur"] ?? "M"}
                />
              ) : a["type_media"] === "video" ? (
                <div className="relative flex h-36 items-center justify-center bg-foreground/85">
                  <Play className="size-7 text-background" />
                  <span className="absolute right-2 top-2 rounded bg-background/90 px-1.5 py-px text-[10px] font-medium">
                    Vidéo
                  </span>
                </div>
              ) : (
                <StripImage src={null} alt="Annonce" fallbackLabel={a["annonceur"] ?? "M"} />
              )}
              <div className="space-y-1.5 p-3">
                <p className="truncate text-xs font-semibold">{a["annonceur"] ?? "Annonceur"}</p>
                {a["titre"] ? (
                  <p className="line-clamp-2-fix text-xs leading-snug">{a["titre"]}</p>
                ) : null}
                {a["texte"] ? (
                  <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">
                    {a["texte"]}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  {a["cta"] ? (
                    <span className="rounded bg-accent px-1.5 py-px text-[10px] font-medium text-primary">
                      {a["cta"]}
                    </span>
                  ) : null}
                  {plateformes.includes("facebook") ? (
                    <Facebook className="size-3 text-muted-foreground" />
                  ) : null}
                  {plateformes.includes("instagram") ? (
                    <Instagram className="size-3 text-muted-foreground" />
                  ) : null}
                </div>
                {a["duree_diffusion_jours"] ? (
                  <p className="text-[10px] text-muted-foreground">
                    Diffusée depuis {a["duree_diffusion_jours"]} j
                  </p>
                ) : null}
              </div>
            </StripCard>
          );
        });
        return { cards, total: items.length };
      }}
    />
  );
}

function firstImageFromMarkdown(md?: unknown): string | null {
  if (typeof md !== "string") return null;
  const mdMatch = md.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch?.[1]) return mdMatch[1];
  const urlMatch = md.match(/https?:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp)/i);
  return urlMatch?.[0] ?? null;
}

function typeSourceLabel(t?: unknown) {
  if (t === "site_marchand") return "Marchand";
  if (t === "comparateur") return "Comparateur";
  return typeof t === "string" && t ? t : null;
}

export function WebPagesStrip({ studyId, row }: { studyId: string; row?: SourceRow | undefined }) {
  return (
    <StripShell
      studyId={studyId}
      source="recherche_web"
      title="Offres web retenues"
      row={row}
      render={(payload) => {
        const items = asArray(payload, "pages")
          .slice()
          .sort((a, b) => {
            const av = a["type_source"] === "site_marchand" ? 0 : 1;
            const bv = b["type_source"] === "site_marchand" ? 0 : 1;
            return av - bv;
          });
        const cards = items.slice(0, MAX_ITEMS).map((p, i) => {
          const img = firstImageFromMarkdown(p["contenu_markdown"]);
          const domaine = typeof p["domaine"] === "string" ? p["domaine"] : "";
          const favicon = domaine
            ? `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domaine)}`
            : null;
          const pertinence =
            typeof p["pertinence"] === "number"
              ? Math.max(
                  0,
                  Math.min(1, p["pertinence"] > 1 ? p["pertinence"] / 100 : p["pertinence"]),
                )
              : null;
          const badge = typeSourceLabel(p["type_source"]);
          return (
            <StripCard key={i} href={p["url"]}>
              {img ? (
                <StripImage
                  src={img}
                  alt={p["titre"] ?? "Page web"}
                  fallbackLabel={domaine || "W"}
                />
              ) : (
                <div className="flex h-36 items-center justify-center bg-gradient-to-br from-accent to-surface">
                  {favicon ? (
                    <img
                      src={favicon}
                      alt={domaine}
                      loading="lazy"
                      className="size-12 rounded-lg bg-surface p-1.5 shadow-card"
                    />
                  ) : (
                    <span className="font-serif text-3xl text-primary/50">W</span>
                  )}
                </div>
              )}
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2-fix min-h-[2.4rem] text-xs leading-snug">
                  {p["titre"] ?? (domaine || "Page")}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{domaine}</p>
                <div className="flex items-center gap-2">
                  {badge ? (
                    <span className="rounded bg-accent px-1.5 py-px text-[10px] font-medium text-primary">
                      {badge}
                    </span>
                  ) : null}
                  {pertinence !== null ? (
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.round(pertinence * 100)}%` }}
                      />
                    </span>
                  ) : null}
                </div>
              </div>
            </StripCard>
          );
        });
        return { cards, total: items.length };
      }}
    />
  );
}
