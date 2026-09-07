/** Cache local des noms de produits (l'API études ne les renvoie pas). */

import type { StudyReport } from "./api";

export interface CachedProduct {
  name: string;
  image_url?: string | null;
}

const KEY = "productNames";

function readAll(): Record<string, CachedProduct> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CachedProduct>) : {};
  } catch {
    return {};
  }
}

export function getProductNames(): Record<string, CachedProduct> {
  return readAll();
}

export function getCachedProduct(productId?: string | null): CachedProduct | undefined {
  if (!productId) return undefined;
  return readAll()[productId];
}

export function cacheProduct(productId: string, product: CachedProduct) {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[productId] = { name: product.name, image_url: product.image_url ?? null };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("product-cache-updated"));
  } catch {
    /* quota dépassé : on ignore */
  }
}

/**
 * Titre du gabarit v2 : `# <nom du produit> — marché <REGION>`.
 *
 * Le tiret cadratin est celui que F7 écrit ; un nom de produit qui en
 * contiendrait un serait tronqué, d'où la préférence donnée au payload.
 */
const TITRE_RAPPORT = /^#\s+(.+?)\s+[—-]\s+march[ée]/mu;

/**
 * Nom du produit tel que le rapport le porte.
 *
 * `GET /studies` ne renvoie ni `product_name` ni `product`, et aucun endpoint ne
 * lit une fiche produit : le rapport est la seule source du nom accessible au
 * client. `payload.produit.nom` d'abord — c'est le champ que F7 remplit ; le
 * titre markdown ne sert que pour les rapports antérieurs au gabarit v2.
 */
export function productNameFromReport(report: StudyReport): string | null {
  const produit = (report.payload as Record<string, unknown> | null | undefined)?.["produit"];
  if (produit && typeof produit === "object") {
    const nom = (produit as Record<string, unknown>)["nom"];
    if (typeof nom === "string" && nom.trim()) return nom.trim();
  }

  for (const md of [report.rapport_markdown, report.resume_markdown]) {
    const match = md?.match(TITRE_RAPPORT);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return null;
}
