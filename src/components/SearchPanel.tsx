"use client";

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
    parts.push(`under ${formatPrice(filters.maxPrice)}`);
  } else if (filters.minPrice !== undefined) {
    parts.push(`over ${formatPrice(filters.minPrice)}`);
  }
  return parts.filter(Boolean).join(" · ");
}

export function SearchPanel({ filters, results, lang, onAdd, onClose }: Props) {
  return (
    <section aria-label={T.searchResults[lang]} className="animate-write">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h2 className="label">{T.searchResults[lang]}</h2>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] text-pencil underline-offset-4 transition hover:text-pen hover:underline"
        >
          {T.clearSearch[lang]}
        </button>
      </div>
      <p className="pt-2 font-mono text-[11px] text-pencil">{describeFilters(filters, lang)}</p>

      {results.length === 0 ? (
        <p className="py-4 text-sm text-pencil">{T.noResults[lang]}</p>
      ) : (
        <ul className="mt-1 divide-y divide-[color:var(--rule)]">
          {results.map(({ product, price, matchedBrand }) => (
            <li key={product.id} className="flex items-baseline gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{product.name[lang]}</span>
              <span className="hidden shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-pencil sm:block">
                {[matchedBrand, product.organic ? T.organic[lang] : null, isOnSale(product) ? T.onSale[lang] : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">{formatPrice(price)}</span>
              <button
                type="button"
                onClick={() => onAdd(product.id)}
                aria-label={`${T.add[lang]} ${product.name[lang]}`}
                className="h-7 w-7 shrink-0 rounded-full font-mono text-base leading-none text-pencil transition hover:bg-pen-soft hover:text-pen"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
