"use client";

import { getProduct } from "@/lib/catalog";
import { T, formatPrice } from "@/lib/i18n";
import { isOnSale, salePrice } from "@/lib/search";
import type { Lang, Suggestion } from "@/lib/types";

const KIND_LABEL: Record<Suggestion["kind"], Record<Lang, string>> = {
  history: { en: "Running low", hi: "खत्म हो रहा" },
  seasonal: { en: "In season", hi: "मौसमी" },
  substitute: { en: "Alternative", hi: "विकल्प" },
  complement: { en: "Goes with", hi: "साथ में" },
  starter: { en: "Popular", hi: "लोकप्रिय" },
};

interface Props {
  suggestions: Suggestion[];
  lang: Lang;
  onAdd: (productId: string) => void;
}

/** Horizontally scrollable cards: history, season, substitutes, pairings. */
export function SuggestionRail({ suggestions, lang, onAdd }: Props) {
  if (!suggestions.length) return null;

  return (
    <section aria-label={T.suggestions[lang]} className="min-w-0 space-y-3">
      <h2 className="px-1 text-sm font-semibold">{T.suggestions[lang]}</h2>
      <ul className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
        {suggestions.map((suggestion) => {
          const product = getProduct(suggestion.productId);
          if (!product) return null;
          return (
            <li
              key={suggestion.id}
              className="animate-rise flex w-64 shrink-0 flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] lg:w-auto"
            >
              <div className="space-y-1.5">
                <span className="inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium">
                  {KIND_LABEL[suggestion.kind][lang]}
                </span>
                <p className="text-sm font-semibold">{product.name[lang]}</p>
                <p className="text-xs leading-relaxed text-text-muted">{suggestion.reason[lang]}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {formatPrice(salePrice(product))}
                  {isOnSale(product) && <span className="ml-1 text-accent">· {T.onSale[lang]}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(product.id)}
                  className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-105 active:scale-95"
                >
                  + {T.add[lang]}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
