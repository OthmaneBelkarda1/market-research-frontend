import { studyErrorText, type StudyError, type StudyStatus } from "./api";

/**
 * Codes ISO 3166-1 alpha-2 officiellement assignés (249).
 *
 * L'API n'expose aucune liste de pays : elle valide le format (deux lettres,
 * casse normalisée côté serveur) et refuse le reste en 422. Cette liste est donc
 * la source de vérité du sélecteur, et non un cache d'une ressource distante.
 *
 * Le pipeline traite tous ces codes. Une poignée de territoires sans devise
 * propre (dépendances) créent bien l'étude, qui bascule aussitôt en `failed`
 * avec `error.code = "CURRENCY_NOT_MAPPED"` — échec immédiat, sans collecte ;
 * cf. STUDY_ERROR_MESSAGE.
 */
const CODES_ISO_3166_1 =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
  "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ " +
  "EC EE EG EH ER ES ET " +
  "FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
  "HK HM HN HR HT HU " +
  "ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ " +
  "LA LB LC LI LK LR LS LT LU LV LY " +
  "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ " +
  "OM " +
  "PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
  "QA " +
  "RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
  "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ " +
  "VA VC VE VG VI VN VU " +
  "WF WS " +
  "YE YT " +
  "ZA ZM ZW ";

export const REGION_CODES: readonly string[] = CODES_ISO_3166_1.trim().split(/\s+/);

/** Marchés d'usage courant, remontés en tête du sélecteur. */
export const REGIONS_FREQUENTES: readonly string[] = ["MA", "FR", "ES", "US", "AE"];

/**
 * Noms français fournis par la plateforme : aucune table de traduction à tenir
 * à jour, et `Intl` suit les renommages de pays. `DisplayNames` peut manquer
 * (runtime sans ICU complet) — on retombe alors sur le code.
 */
const displayNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

const normalizedCode = (code?: string | null) => (code ?? "").trim().toUpperCase();

export function regionLabel(code?: string | null): string {
  const c = normalizedCode(code);
  if (!/^[A-Z]{2}$/.test(c)) return (code ?? "").trim();
  try {
    return displayNames?.of(c) ?? c;
  } catch {
    return c;
  }
}

/** Drapeau dérivé du code (indicateurs régionaux Unicode) : marche pour les 249. */
export function regionFlag(code?: string | null) {
  const c = normalizedCode(code);
  if (!/^[A-Z]{2}$/.test(c)) return "🏳️";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export interface Region {
  code: string;
  label: string;
  flag: string;
  /** Libellé + code sans accents ni casse : ce sur quoi la recherche filtre. */
  search: string;
}

const deburr = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const collator = new Intl.Collator("fr", { sensitivity: "base" });

export const REGIONS: Region[] = REGION_CODES.map((code) => {
  const label = regionLabel(code);
  return { code, label, flag: regionFlag(code), search: `${deburr(label)} ${code.toLowerCase()}` };
}).sort((a, b) => collator.compare(a.label, b.label));

const REGION_BY_CODE = new Map(REGIONS.map((r) => [r.code, r]));

export function findRegion(code?: string | null): Region | undefined {
  return REGION_BY_CODE.get(normalizedCode(code));
}

/**
 * Codes d'erreur d'étude qui méritent une phrase plutôt que leur libellé brut.
 * `CURRENCY_NOT_MAPPED` n'est pas une panne : le territoire choisi n'a pas de
 * devise propre, l'étude s'arrête avant toute collecte et rien n'est facturé.
 */
export const STUDY_ERROR_MESSAGE: Record<string, string> = {
  CURRENCY_NOT_MAPPED:
    "Ce territoire n'a pas de devise propre dans le référentiel : l'étude ne peut pas être chiffrée. " +
    "Elle s'est arrêtée avant toute collecte — rien n'a été consommé. " +
    "Relancez-la sur le pays dont dépend ce territoire, ou sur un marché voisin.",
};

/** Texte d'erreur d'étude prêt à l'affichage : phrase connue si le code en a une. */
export function studyErrorDisplay(error?: StudyError | null): string | null {
  const code =
    error && typeof error === "object" && typeof error.code === "string"
      ? error.code.trim().toUpperCase()
      : "";
  return STUDY_ERROR_MESSAGE[code] ?? studyErrorText(error);
}

export function studyErrorCode(error?: StudyError | null): string | null {
  if (error && typeof error === "object" && typeof error.code === "string") {
    return error.code.trim().toUpperCase() || null;
  }
  return null;
}

export const COLLECTORS = [
  { key: "google_trends", label: "Google Trends" },
  { key: "reddit", label: "Reddit" },
  { key: "recherche_web", label: "Recherche web" },
  { key: "aliexpress", label: "AliExpress" },
  { key: "amazon", label: "Amazon" },
  { key: "meta_ads", label: "Meta Ads" },
] as const;

export const ANALYSES = [
  { key: "f3_insights", label: "Insights consommateurs (F3)" },
  { key: "f4_concurrence", label: "Analyse concurrentielle (F4)" },
  { key: "f5_verdict", label: "Verdict stratégique (F5)" },
  { key: "f6_plc", label: "Cycle de vie produit (F6)" },
  { key: "f7_rapport", label: "Rapport final (F7)" },
] as const;

export const ALL_MODULES = [...COLLECTORS, ...ANALYSES];

export const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string; bg: string; active?: boolean }
> = {
  created: {
    label: "Créée",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-accent",
    active: true,
  },
  collecting: {
    label: "Collecte",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-accent",
    active: true,
  },
  analyzing: {
    label: "Analyse",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-accent",
    active: true,
  },
  reporting: {
    label: "Rapport",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-accent",
    active: true,
  },
  completed: {
    label: "Terminée",
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success-soft",
  },
  partial: {
    label: "Étude partielle",
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning-soft",
  },
  failed: {
    label: "Échouée",
    dot: "bg-danger",
    text: "text-danger",
    bg: "bg-danger-soft",
  },
};

export function statusMeta(status?: string | null) {
  return (
    STATUS_META[status ?? ""] ?? {
      label: status ?? "Inconnu",
      dot: "bg-muted-foreground",
      text: "text-muted-foreground",
      bg: "bg-muted",
    }
  );
}

export const SOURCE_STATUS_LABEL: Record<string, string> = {
  succeeded: "Succès",
  failed: "Échec",
  skipped_region: "Région non couverte",
  /** Le collecteur a tourné sans rien rapporter : ce n'est pas une panne. */
  empty: "Aucun résultat",
  running: "En cours",
  pending: "En attente",
};

export type ModuleState = "done" | "empty" | "running" | "failed" | "pending";

/** Parsing défensif de progress : renvoie état + durée par module. */
export function readModule(
  progress: Record<string, unknown> | null | undefined,
  key: string,
): { state: ModuleState; duration?: number | undefined } {
  const raw = progress?.[key];
  if (raw === undefined || raw === null) return { state: "pending" };

  let status: string | undefined;
  let duration: number | undefined;
  let exitCode: number | undefined;

  if (typeof raw === "string") {
    status = raw;
  } else if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o["status"] === "string") status = o["status"];
    if (typeof o["duration_seconds"] === "number") duration = o["duration_seconds"];
    if (typeof o["exit_code"] === "number") exitCode = o["exit_code"];
  }

  const s = (status ?? "").toLowerCase();
  let state: ModuleState = "pending";
  if (["succeeded", "success", "completed", "done", "ok"].includes(s)) state = "done";
  else if (["failed", "error", "failure"].includes(s)) state = "failed";
  else if (["running", "in_progress", "started", "collecting", "analyzing"].includes(s))
    state = "running";
  else if (s === "empty") state = "empty";
  else if (s === "skipped_region" || s === "skipped") state = "done";
  else if (status === undefined && exitCode !== undefined)
    state = exitCode === 0 ? "done" : "failed";
  else if (status === undefined && duration !== undefined) state = "done";

  return { state, duration };
}

export interface PhaseDurations {
  collecting?: number | undefined;
  analyzing?: number | undefined;
  reporting?: number | undefined;
  total?: number | undefined;
}

export function readPhaseDurations(
  progress: Record<string, unknown> | null | undefined,
): PhaseDurations {
  const raw = progress?.["phase_durations"];
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    collecting: num(o["collecting"]),
    analyzing: num(o["analyzing"]),
    reporting: num(o["reporting"]),
    total: num(o["total"]),
  };
}

export function phaseOfStatus(status?: string | null): 0 | 1 | 2 | 3 {
  switch (status) {
    case "created":
    case "collecting":
      return 0;
    case "analyzing":
      return 1;
    case "reporting":
      return 2;
    default:
      return 3;
  }
}

export function shortId(id?: string | null) {
  return `Étude ${(id ?? "").slice(0, 8)}`;
}

const nf = new Intl.NumberFormat("fr-FR");

export function formatNumber(n: number) {
  return nf.format(n);
}

export function formatDuration(seconds?: number | null) {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return null;
  if (seconds < 60) return `${nf.format(Math.round(seconds))} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / 2592000), "month");
}

export function dateGroup(iso?: string | null): "today" | "week" | "older" {
  if (!iso) return "older";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "older";
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (d >= startOfToday.getTime()) return "today";
  if (now - d < 7 * 86400_000) return "week";
  return "older";
}

export function isActiveStatus(status?: string | null): boolean {
  return ["created", "collecting", "analyzing", "reporting"].includes(status ?? "");
}

export type { StudyStatus };
