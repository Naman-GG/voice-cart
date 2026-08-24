import { CATALOG } from "./catalog";
import { matchProduct } from "./nlp/match";
import { normalize, singularize } from "./nlp/normalize";
import type { Product, SearchFilters, SearchResult } from "./types";

/** Deterministic pseudo-discount so "on sale" badges stay stable per product. */
export function isOnSale(product: Product): boolean {
  let hash = 0;
  for (let i = 0; i < product.id.length; i += 1) hash = (hash * 31 + product.id.charCodeAt(i)) >>> 0;
  return hash % 5 === 0;
}

export function salePrice(product: Product): number {
  return isOnSale(product) ? Number((product.price * 0.85).toFixed(2)) : product.price;
}

function textScore(product: Product, query: string): number {
  if (!query) return 0.5;
  const needle = normalize(query);
  if (!needle) return 0.5;
  const folded = needle.split(" ").map(singularize).join(" ");
  let best = 0;
  for (const alias of product.aliases) {
    const hay = normalize(alias);
    const haystackFolded = hay.split(" ").map(singularize).join(" ");
    if (hay === needle || haystackFolded === folded) best = Math.max(best, 1);
    else if (hay.includes(needle) || needle.includes(hay)) best = Math.max(best, 0.75);
  }
  if (best === 0 && normalize(product.name.en).includes(needle)) best = 0.6;
  return best;
}

/**
 * Filters the catalog by a spoken query plus optional price, brand,
 * size and organic constraints. Returns at most `limit` ranked results.
 */
export function searchCatalog(filters: SearchFilters, limit = 12): SearchResult[] {
  const { query, maxPrice, minPrice, brand, organicOnly, size, category } = filters;
  const normalizedBrand = brand ? normalize(brand) : null;

  // Resolve the query to a catalog product so related items rank alongside it.
  const tokens = normalize(query).split(" ").filter(Boolean);
  const anchor = tokens.length ? matchProduct(tokens)?.product ?? null : null;

  const scored = CATALOG.map((product) => {
    let score = textScore(product, query);
    if (anchor) {
      if (product.id === anchor.id) score = Math.max(score, 1);
      else if (anchor.substitutes?.includes(product.id)) score = Math.max(score, 0.7);
      else if (anchor.goesWith?.includes(product.id)) score = Math.max(score, 0.5);
      else if (category && product.category === category) score = Math.max(score, 0.3);
    }
    return { product, score };
  })
    // 0.3 keeps same-aisle products out unless they also match by name.
    .filter((entry) => entry.score >= 0.45)
    .filter((entry) => {
      const price = salePrice(entry.product);
      if (maxPrice !== undefined && price > maxPrice) return false;
      if (minPrice !== undefined && price < minPrice) return false;
      if (organicOnly && !entry.product.organic) return false;
      if (size && !entry.product.sizes.some((option) => normalize(option) === normalize(size))) {
        // Size is a soft filter: keep the product but push it down the ranking.
        entry.score -= 0.15;
      }
      if (normalizedBrand) {
        return entry.product.brands.some((option) => normalize(option) === normalizedBrand);
      }
      return true;
    })
    .sort((a, b) => b.score - a.score || salePrice(a.product) - salePrice(b.product))
    .slice(0, limit);

  return scored.map((entry) => ({
    product: entry.product,
    matchedBrand: normalizedBrand
      ? entry.product.brands.find((option) => normalize(option) === normalizedBrand)
      : undefined,
    price: salePrice(entry.product),
  }));
}
