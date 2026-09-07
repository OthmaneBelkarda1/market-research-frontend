/**
 * URL absolue du backend FastAPI, résolue au build depuis `VITE_API_BASE_URL`.
 *
 * Utilisée telle quelle côté serveur (proxy SSR, cf. `src/server.ts`). Le
 * navigateur, lui, ne l'appelle jamais en direct : il passe par `/api/backend`
 * sur sa propre origine, ce qui évite tout CORS. Voir `src/lib/api.ts`.
 */
export const BACKEND_URL = (
  import.meta.env["VITE_API_BASE_URL"] ?? "https://market-research-backend-zhz2.onrender.com"
).replace(/\/+$/, "");

/** Préfixe same-origin servi par le proxy SSR. */
export const BACKEND_PROXY_PREFIX = "/api/backend";
