import { useEffect, useState } from "react";
import { getCachedProduct, getProductNames, type CachedProduct } from "@/lib/product-cache";

/** Lit le cache produits côté client uniquement (évite les écarts d'hydratation). */
export function useProductNames(): Record<string, CachedProduct> {
  const [names, setNames] = useState<Record<string, CachedProduct>>({});

  useEffect(() => {
    const sync = () => setNames(getProductNames());
    sync();
    window.addEventListener("product-cache-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("product-cache-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return names;
}

export function useProductName(productId?: string | null): CachedProduct | undefined {
  const [p, setP] = useState<CachedProduct | undefined>(undefined);
  useEffect(() => {
    const sync = () => setP(getCachedProduct(productId));
    sync();
    window.addEventListener("product-cache-updated", sync);
    return () => window.removeEventListener("product-cache-updated", sync);
  }, [productId]);
  return p;
}
