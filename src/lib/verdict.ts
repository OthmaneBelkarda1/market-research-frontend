/**
 * Verdict stratégique d'une étude (F5, restitué par le rapport F7).
 *
 * `GET /studies` ne le renvoie pas : la liste ne porte que le statut du pipeline.
 * Le verdict n'existe que dans le rapport, sous deux formes — `payload.controles
 * .libelle_verdict` (source de vérité) et le titre « Décision : … » du markdown
 * (repli si le payload manque, cas des anciens gabarits).
 */

import type { StudyReport } from "./api";

export type VerdictKey = "go" | "conditional" | "no_go";

/**
 * Un verdict, une couleur, partout : Go en vert, Go conditionnel en orange,
 * No Go en rouge. `accent` alimente `--title-accent`, que lisent les filets des
 * utilitaires `title-bar` / `title-rule` (cf. styles.css) — c'est ce qui colore
 * le titre « Décision : … » du rapport comme la pastille de la liste.
 */
export const VERDICT_META: Record<
  VerdictKey,
  { label: string; group: string; dot: string; text: string; bg: string; accent: string }
> = {
  go: {
    label: "Go",
    group: "Go",
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success-soft",
    accent: "[--title-accent:var(--success)]",
  },
  conditional: {
    label: "Go conditionnel",
    group: "Go conditionnel",
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning-soft",
    accent: "[--title-accent:var(--warning)]",
  },
  no_go: {
    label: "No Go",
    group: "No Go",
    dot: "bg-danger",
    text: "text-danger",
    bg: "bg-danger-soft",
    accent: "[--title-accent:var(--danger)]",
  },
};

export const VERDICT_ORDER: readonly VerdictKey[] = ["go", "conditional", "no_go"];

const deburr = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Normalise un libellé de verdict. L'ordre des tests compte : « No Go » contient
 * « go », et « Go conditionnel » aussi. Le verdict calculé (positif / indéterminé
 * / négatif) est accepté au même titre que son libellé, les deux circulant dans
 * le rapport.
 */
export function verdictFromLabel(raw?: string | null): VerdictKey | null {
  const s = deburr(raw ?? "").trim();
  if (!s) return null;
  if (s.includes("conditionn") || s.includes("indetermin") || s.includes("sous reserve")) {
    return "conditional";
  }
  if (/no[\s-]?go/.test(s) || s.includes("negatif") || s.includes("defavorable")) return "no_go";
  if (/\bgo\b/.test(s) || s.includes("positif") || s.includes("favorable")) return "go";
  return null;
}

/** Corps d'un titre de décision, dièses retirés : « Décision : Go conditionnel — lancer… ». */
const CORPS_DECISION = /^D[ée]cision\s*:\s*(.+)$/;

/** Titre de décision du gabarit, tel qu'il apparaît dans le markdown. */
const TITRE_DECISION = /^#{1,4}\s*(D[ée]cision\s*:[^\n]+)$/m;

/**
 * Verdict porté par un titre « Décision : … », dièses déjà retirés — c'est par là
 * que le rendu Markdown colore la ligne de décision du rapport.
 */
export function verdictFromDecisionTitle(titre?: string | null): VerdictKey | null {
  const match = CORPS_DECISION.exec((titre ?? "").trim());
  if (!match) return null;
  // Le titre poursuit sur une glose (« — lancer, mais sous conditions ») : seul
  // le libellé qui précède le tiret nous intéresse.
  return verdictFromLabel(match[1]?.split(/[—–]/)[0]);
}

export function verdictFromReport(report: StudyReport): VerdictKey | null {
  const controles = (report.payload as Record<string, unknown> | null | undefined)?.["controles"];
  if (controles && typeof controles === "object") {
    const libelle = (controles as Record<string, unknown>)["libelle_verdict"];
    const fromPayload = verdictFromLabel(typeof libelle === "string" ? libelle : null);
    if (fromPayload) return fromPayload;
  }

  for (const md of [report.resume_markdown, report.rapport_markdown]) {
    const match = md?.match(TITRE_DECISION);
    if (!match) continue;
    const fromMarkdown = verdictFromDecisionTitle(match[1]);
    if (fromMarkdown) return fromMarkdown;
  }

  return null;
}
