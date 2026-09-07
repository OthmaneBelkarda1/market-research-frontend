import "./lib/error-capture";

import { BACKEND_PROXY_PREFIX, BACKEND_URL } from "./lib/backend-url";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Relais same-origin vers le backend FastAPI.
//
// Le navigateur appelle `/api/backend/...` sur sa propre origine plutôt que le
// domaine Render : il n'y a donc pas de requête cross-origin, donc pas de
// préflight ni de header `Access-Control-Allow-Origin` à tenir à jour. Sans ça,
// chaque URL de déploiement Vercel (une par commit) devrait être ajoutée à la
// main dans `CORS_ORIGINS` côté backend.
//
// Les en-têtes de saut (`host`, `origin`, ...) ne sont pas relayés : ils
// décrivent la connexion navigateur->Vercel, pas Vercel->Render, et `host`
// ferait répondre Render sur le mauvais virtual host.
const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "accept-encoding",
]);

// `fetch` décompresse déjà le corps ; réémettre `content-encoding` ferait
// décoder une seconde fois au navigateur, et `content-length` ne vaudrait plus
// pour le corps décompressé.
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

async function proxyToBackend(request: Request, url: URL): Promise<Response> {
  const target = new URL(
    BACKEND_URL + url.pathname.slice(BACKEND_PROXY_PREFIX.length) + url.search,
  );

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(name.toLowerCase())) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      // Node exige ce drapeau pour streamer un corps de requête.
      ...(request.body ? { duplex: "half" } : {}),
      redirect: "manual",
    } as RequestInit);
  } catch (error) {
    console.error("Backend proxy failed:", error);
    return Response.json(
      { detail: { code: "backend_unreachable", message: "Le backend est injoignable." } },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers) {
    if (!STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith(BACKEND_PROXY_PREFIX + "/")) {
        return await proxyToBackend(request, url);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
