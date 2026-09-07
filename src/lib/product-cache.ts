/** Cache local des noms de produits (l'API études ne les renvoie pas). */

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
