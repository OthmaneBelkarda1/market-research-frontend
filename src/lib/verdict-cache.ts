/**
 * Cache local des verdicts par étude.
 *
 * Lire un verdict coûte un `GET /studies/{id}/report` entier (plusieurs dizaines
 * de Ko) alors qu'il ne bouge plus une fois le rapport écrit : on le conserve,
 * comme les noms de produits, plutôt que de retélécharger le rapport à chaque
 * affichage de la liste.
 */

import type { VerdictKey } from "./verdict";

const KEY = "studyVerdicts";
export const VERDICT_CACHE_EVENT = "verdict-cache-updated";

const VALID: readonly string[] = ["go", "conditional", "no_go"];

function readAll(): Record<string, VerdictKey> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, VerdictKey> = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && VALID.includes(v)) out[id] = v as VerdictKey;
    }
    return out;
  } catch {
    return {};
  }
}

export function getVerdicts(): Record<string, VerdictKey> {
  return readAll();
}

export function getCachedVerdict(studyId?: string | null): VerdictKey | undefined {
  if (!studyId) return undefined;
  return readAll()[studyId];
}

export function cacheVerdict(studyId: string, verdict: VerdictKey) {
  if (typeof window === "undefined") return;
  const all = readAll();
  if (all[studyId] === verdict) return;
  all[studyId] = verdict;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(VERDICT_CACHE_EVENT));
  } catch {
    /* quota dépassé : on ignore */
  }
}
