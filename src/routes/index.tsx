import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import { api, conflictStudyId, errorMessage, type Product } from "@/lib/api";
import { cacheProduct } from "@/lib/product-cache";
import { RegionSelect } from "@/components/region-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/heading";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nouvelle étude — Études de Marché IA" },
      {
        name: "description",
        content:
          "Lancez une étude de marché e-commerce automatisée : collecte multi-sources et analyses IA pour Marketing Confort.",
      },
      { property: "og:title", content: "Nouvelle étude — Études de Marché IA" },
      {
        property: "og:description",
        content: "Lancez une étude de marché e-commerce automatisée en quelques secondes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewStudyPage,
});

const EXTRACT_STEPS = [
  "Chargement de la page…",
  "Lecture de la fiche produit…",
  "Extraction des caractéristiques…",
  "Peut prendre jusqu'à 2 minutes",
];

function NewStudyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"url" | "manuel">("url");
  const [region, setRegion] = useState("MA");
  const [url, setUrl] = useState("");
  const [useAgent, setUseAgent] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    image_url: "",
  });
  const [busy, setBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!busy || tab !== "url") return;
    const t = setInterval(() => setStepIndex((i) => (i + 1) % EXTRACT_STEPS.length), 4000);
    return () => clearInterval(t);
  }, [busy, tab]);

  /**
   * Le backend démarre déjà une étude à la création de la fiche produit
   * (`STUDY_AUTO_START`) : le 409 renvoie alors l'identifiant de cette étude-là.
   * Sinon, `POST /studies` renvoie l'étude créée. Un seul aller-retour dans les deux cas.
   */
  async function resolveStudy(product: Product) {
    cacheProduct(product.id, { name: product.name, image_url: product.image_url ?? null });

    try {
      const study = await api.createStudy({
        product_id: product.id,
        region: product.region ?? region,
      });
      return study.id;
    } catch (e) {
      const conflict = conflictStudyId(e);
      if (conflict) return conflict;
      throw e;
    }
  }

  async function go(product: Product) {
    const studyId = await resolveStudy(product);
    queryClient.invalidateQueries({ queryKey: ["studies", "sidebar"] });
    navigate({ to: "/etudes/$id", params: { id: studyId } });
  }

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Renseignez une URL produit.");
      return;
    }
    setBusy(true);
    setStepIndex(0);
    try {
      const res = await api.extractProduct({ url: url.trim(), region, use_agent: useAgent });
      if (res.warnings?.length) {
        toast.warning(res.warnings.join(" · "));
      }
      await go(res.product);
    } catch (err) {
      toast.error(errorMessage(err, "L'extraction a échoué."));
    } finally {
      setBusy(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim() || !form.category.trim()) {
      toast.error("Nom, description et catégorie sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      const product = await api.createProduct({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        region,
        ...(form.image_url.trim() ? { image_url: form.image_url.trim() } : {}),
      });
      await go(product);
    } catch (err) {
      toast.error(errorMessage(err, "La création du produit a échoué."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-10 md:pt-20">
      <PageTitle
        eyebrow="Études de marché IA"
        size="hero"
        align="center"
        rule
        description="Analysez un produit e-commerce : tendances, concurrence, annonces et offres du marché, collectées puis synthétisées automatiquement."
      >
        Quelle étude de marché lançons-nous ?
      </PageTitle>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-soft md:p-6">
        <div className="mb-5 inline-flex rounded-xl bg-muted p-1">
          {(
            [
              ["url", "Depuis une URL produit"],
              ["manuel", "Saisie manuelle"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "url" ? (
          <form onSubmit={submitUrl} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="url">URL du produit</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…/produit"
                className="h-11 rounded-xl bg-surface"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pays ciblé</Label>
              <RegionSelect value={region} onChange={setRegion} disabled={busy} />
              <p className="text-xs text-muted-foreground">
                L'étude couvre tous les pays. Sur les marchés les moins courants, un site qui change
                de devise selon la langue du navigateur peut afficher son prix américain : le
                chiffre extrait reste celui de la page, pas une erreur.
              </p>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/70 px-4 py-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Sparkles className="size-3.5 text-primary" />
                  Extraction assistée par IA
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Un agent lit la page comme un humain : plus fiable sur les sites complexes, mais
                  plus lent.
                </p>
              </div>
              <Switch checked={useAgent} onCheckedChange={setUseAgent} disabled={busy} />
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
              {busy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {EXTRACT_STEPS[stepIndex]}
                </span>
              ) : (
                "Lancer l'étude"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitManual} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom du produit</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11 rounded-xl bg-surface"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="rounded-xl bg-surface"
                disabled={busy}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category">Catégorie</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-11 rounded-xl bg-surface"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pays ciblé</Label>
                <RegionSelect value={region} onChange={setRegion} disabled={busy} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="image">URL d'image (optionnel)</Label>
              <Input
                id="image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…/image.jpg"
                className="h-11 rounded-xl bg-surface"
                disabled={busy}
              />
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
              {busy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Création de l'étude…
                </span>
              ) : (
                "Lancer l'étude"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
