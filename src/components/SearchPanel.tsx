"use client";

import { CATEGORIES } from "@/lib/catalog";
import { T, formatPrice } from "@/lib/i18n";
import { isOnSale } from "@/lib/search";
import type { Lang, SearchFilters, SearchResult } from "@/lib/types";

interface Props {
  filters: SearchFilters;
  results: SearchResult[];
  lang: Lang;
  onAdd: (productId: string) => void;
  onClose: () => void;
}

function describeFilters(filters: SearchFilters, lang: Lang): string {
  const parts: string[] = [filters.query];
  if (filters.brand) parts.push(filters.brand);
  if (filters.organicOnly) parts.push(T.organic[lang]);
  if (filters.size) parts.push(filters.size);
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    parts.push(`${formatPrice(filters.minPrice)}–${formatPrice(filters.maxPrice)}`);
  } else if (filters.maxPrice !== undefined) {
    parts.push(`< ${formatPrice(filters.maxPrice)}`);
  } else if (filters.minPrice !== undefined) {
    parts.push(`> ${formatPrice(filters.minPrice)}`);
  }
  return parts.filter(Boolean).join(" · ");
}

/** Voice-activated search results with the active filters made visible. */
export function SearchPanel({ filters, results, lang, onAdd, onClose }: Props) {
  return (
    <section
      aria-label={T.searchResults[lang]}
      className="animate-rise space-y-3 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{T.searchResults[lang]}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{describeFilters(filters, lang)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line px-3 py-1 text-xs text-text-muted transition hover:text-text"
        >
          {T.clearSearch[lang]}
        </button>
      </div>

      {results.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">{T.noResults[lang]}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {results.map(({ product, price, matchedBrand }) => (
            <li
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <span aria-hidden className="mr-1">{CATEGORIES[product.category].emoji}</span>
                  {product.name[lang]}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {[
                    matchedBrand,
                    product.sizes[Math.min(1, product.sizes.length - 1)],
                    product.organic ? T.organic[lang] : null,
                    isOnSale(product) ? T.onSale[lang] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{formatPrice(price)}</span>
                <button
                  type="button"
                  onClick={() => onAdd(product.id)}
                  aria-label={`${T.add[lang]} ${product.name[lang]}`}
                  className="h-7 w-7 rounded-full bg-accent text-sm font-bold text-[color:var(--accent-contrast)] transition hover:brightness-105 active:scale-95"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
