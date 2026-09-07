/**
 * Module unique d'accès à l'API FastAPI « Études de Marché ».
 * Aucune donnée n'est simulée : en cas d'échec, l'erreur est propagée.
 */

import { BACKEND_PROXY_PREFIX, BACKEND_URL } from "./backend-url";

/**
 * Base des appels API.
 *
 * Dans le navigateur on vise `/api/backend` : le serveur SSR relaie vers le
 * backend (cf. `src/server.ts`). Les requêtes restent donc same-origin, ce qui
 * supprime toute dépendance au CORS -- et donc au domaine exact du déploiement,
 * qui change à chaque preview Vercel.
 *
 * Côté serveur, une URL relative n'est pas résolvable : on garde l'absolue.
 */
export const API_BASE_URL = typeof window === "undefined" ? BACKEND_URL : BACKEND_PROXY_PREFIX;

export type StudyStatus =
  | "created"
  | "collecting"
  | "analyzing"
  | "reporting"
  | "completed"
  | "partial"
  | "failed";

export const ACTIVE_STATUSES: StudyStatus[] = ["created", "collecting", "analyzing", "reporting"];

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  region: string;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** `error` de l'API : `{code, message}`. Le string reste toléré (anciennes réponses). */
export type StudyError = { code?: string | null; message?: string | null } | string;

export interface Study {
  id: string;
  product_id: string;
  region: string;
  langue?: string | null;
  devise?: string | null;
  status: StudyStatus | string;
  trigger_source?: string | null;
  progress?: Record<string, unknown> | null;
  error?: StudyError | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Champs éventuels futurs pour le nom du produit (parsing défensif). */
  product_name?: string | null;
  product?: { name?: string | null; image_url?: string | null } | null;
}

export interface StudyList {
  items: Study[];
  total: number;
  limit: number;
  offset: number;
}

export type SourceKey =
  | "google_trends"
  | "reddit"
  | "recherche_web"
  | "aliexpress"
  | "amazon"
  | "meta_ads";

export interface SourceRow {
  source: string;
  /** `empty` : le collecteur a tourné sans rien rapporter (ni succès, ni panne). */
  status: "succeeded" | "failed" | "skipped_region" | "empty" | string;
  error?: string | null;
  exit_code?: number | null;
  duration_seconds?: number | null;
}

export interface SourceDetail extends SourceRow {
  id?: string;
  study_id?: string;
  payload?: unknown;
  created_at?: string;
  updated_at?: string;
}

/** Livrable de l'étude : GET /studies/{id}/report. */
export interface StudyReport {
  id: string;
  study_id: string;
  rapport_markdown: string;
  resume_markdown?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string;
}

export interface ExtractResponse {
  product: Product;
  source_url: string;
  warnings: string[];
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class NetworkError extends Error {
  constructor(message = "Impossible de joindre le serveur.") {
    super(message);
    this.name = "NetworkError";
  }
}

function detailToMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as any).msg) : null))
      .filter(Boolean);
    if (msgs.length) return msgs.join(" · ");
  }
  if (detail && typeof detail === "object") {
    const message = (detail as any).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 45_000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error)?.name === "AbortError") {
      throw new NetworkError("Délai dépassé : le serveur met trop de temps à répondre.");
    }
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const detail = body && typeof body === "object" ? (body as any).detail : body;
    throw new ApiError(
      detailToMessage(detail, `Erreur ${response.status} du serveur.`),
      response.status,
      detail,
    );
  }

  return body as T;
}

export const api = {
  createProduct: (input: {
    name: string;
    description: string;
    category: string;
    region: string;
    image_url?: string;
  }) => request<Product>("/products", { method: "POST", body: JSON.stringify(input) }),

  extractProduct: (input: { url: string; region: string; use_agent: boolean }) =>
    request<ExtractResponse>("/products/extract", {
      method: "POST",
      body: JSON.stringify(input),
      // Au-dessus du budget du serveur (EXTRACTION_TIMEOUT_SECONDS = 300 s), pas en
      // dessous : a 180 s le client abandonnait une extraction que le serveur menait
      // a bien, et l'utilisateur lisait « Delai depasse » alors que la fiche produit
      // etait bel et bien creee. Le 504 du serveur arrive maintenant en premier et
      // dit ce qui s'est reellement passe.
      timeoutMs: 310_000,
    }),

  /** 202 : l'étude créée est renvoyée telle quelle, inutile de la rechercher ensuite. */
  createStudy: (input: { product_id: string; region: string }) =>
    request<Study>("/studies", { method: "POST", body: JSON.stringify(input) }),

  listStudies: (params: {
    product_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<StudyList>(`/studies${suffix}`);
  },

  getStudy: (id: string) => request<Study>(`/studies/${id}`),

  getSources: (id: string) => request<{ items: SourceRow[]; total: number }>(`/studies/${id}/sources`),

  getSource: (id: string, source: string) =>
    request<SourceDetail>(`/studies/${id}/sources/${source}`, { timeoutMs: 90_000 }),

  /** 404 tant que F7 n'a pas produit de rapport (étude en cours ou échouée). */
  getReport: (id: string) => request<StudyReport>(`/studies/${id}/report`, { timeoutMs: 90_000 }),
};

/** Extrait le study_id d'un conflit 409 renvoyé par POST /studies. */
export function conflictStudyId(error: unknown): string | null {
  if (error instanceof ApiError && error.status === 409) {
    const d = error.detail;
    if (d && typeof d === "object" && typeof (d as any).study_id === "string") {
      return (d as any).study_id;
    }
  }
  return null;
}

/** Aplatit le `error` d'une étude (`{code, message}` ou string) en texte affichable. */
export function studyErrorText(error?: StudyError | null): string | null {
  if (!error) return null;
  if (typeof error === "string") return error.trim() || null;
  const message = typeof error.message === "string" ? error.message.trim() : "";
  const code = typeof error.code === "string" ? error.code.trim() : "";
  if (message && code) return `${message} (${code})`;
  return message || code || null;
}

export function errorMessage(error: unknown, fallback = "Une erreur est survenue."): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
