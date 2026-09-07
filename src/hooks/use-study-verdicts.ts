import { useEffect, useMemo, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api, type Study } from "@/lib/api";
import { verdictFromReport, type VerdictKey } from "@/lib/verdict";
import { cacheVerdict, getVerdicts, VERDICT_CACHE_EVENT } from "@/lib/verdict-cache";

/**
 * Le verdict n'existe que dans le rapport : le connaître pour toute la liste
 * suppose un `GET /report` par étude terminée. Deux garde-fous : le cache local
 * (une étude n'est lue qu'une fois, jamais deux sessions de suite) et cette
 * file à deux requêtes, pour ne pas envoyer cinquante rapports d'un coup à un
 * serveur qui sort peut-être de veille.
 */
const PARALLELISME = 2;

const enAttente = new Set<string>();
const sansVerdict = new Set<string>();
const file: string[] = [];
let enCours = 0;

const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

async function lire(id: string, queryClient: QueryClient) {
  try {
    const report = await api.getReport(id);
    // Le rapport est déjà payé : on le dépose dans le cache de requêtes pour que
    // l'ouverture de l'étude ne le retélécharge pas.
    queryClient.setQueryData(["report", id], report);
    const verdict = verdictFromReport(report);
    if (verdict) cacheVerdict(id, verdict);
    else sansVerdict.add(id);
  } catch {
    // 404 (pas encore de rapport) comme panne réseau : on n'insiste pas dans
    // cette session, la liste se recharge de toute façon toutes les 30 s.
    sansVerdict.add(id);
  } finally {
    enAttente.delete(id);
  }
}

function pomper(queryClient: QueryClient) {
  while (enCours < PARALLELISME && file.length) {
    const id = file.shift();
    if (!id) break;
    enCours += 1;
    void lire(id, queryClient).finally(() => {
      enCours -= 1;
      notifier();
      pomper(queryClient);
    });
  }
}

function demanderVerdicts(ids: string[], connus: Record<string, VerdictKey>, qc: QueryClient) {
  let ajout = false;
  for (const id of ids) {
    if (connus[id] || enAttente.has(id) || sansVerdict.has(id)) continue;
    enAttente.add(id);
    file.push(id);
    ajout = true;
  }
  if (ajout) {
    notifier();
    pomper(qc);
  }
}

/** Une étude ne porte de verdict qu'une fois son rapport écrit. */
export function peutAvoirVerdict(study: Study) {
  return study.status === "completed" || study.status === "partial";
}

export interface StudyVerdicts {
  map: Record<string, VerdictKey>;
  /** Nombre d'études dont le verdict est encore en cours de lecture. */
  pending: number;
}

export function useStudyVerdicts(studies: Study[]): StudyVerdicts {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StudyVerdicts>({ map: {}, pending: 0 });

  useEffect(() => {
    const sync = () => setState({ map: getVerdicts(), pending: enAttente.size });
    sync();
    abonnes.add(sync);
    window.addEventListener(VERDICT_CACHE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      abonnes.delete(sync);
      window.removeEventListener(VERDICT_CACHE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const ids = useMemo(() => studies.filter(peutAvoirVerdict).map((s) => s.id), [studies]);
  const cle = ids.join(",");

  useEffect(() => {
    if (!cle) return;
    demanderVerdicts(cle.split(","), getVerdicts(), queryClient);
  }, [cle, queryClient]);

  return state;
}
