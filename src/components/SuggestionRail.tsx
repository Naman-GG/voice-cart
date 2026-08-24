"use client";

import { getProduct } from "@/lib/catalog";
import { T, formatPrice } from "@/lib/i18n";
import { isOnSale, salePrice } from "@/lib/search";
import type { Lang, Suggestion } from "@/lib/types";

const KIND_LABEL: Record<Suggestion["kind"], Record<Lang, string>> = {
  history: { en: "Running low", hi: "खत्म हो रहा" },
  seasonal: { en: "In season", hi: "मौसमी" },
  substitute: { en: "Instead of", hi: "इसकी जगह" },
  complement: { en: "Goes with", hi: "साथ में" },
  starter: { en: "Popular", hi: "लोकप्रिय" },
};

interface Props {
  suggestions: Suggestion[];
  lang: Lang;
  onAdd: (productId: string) => void;
}

/** Pencilled-in candidates beside the list: a name, a reason, and a plus. */
export function SuggestionRail({ suggestions, lang, onAdd }: Props) {
  if (!suggestions.length) return null;

  return (
    <section aria-label={T.suggestions[lang]}>
      <h2 className="label border-b border-rule pb-2">{T.suggestions[lang]}</h2>
      <ul className="divide-y divide-[color:var(--rule)]">
        {suggestions.map((suggestion) => {
          const product = getProduct(suggestion.productId);
          if (!product) return null;
          return (
            <li key={suggestion.id} className="animate-write flex items-baseline gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="text-[15px] text-ink">{product.name[lang]}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-pencil">
                    {KIND_LABEL[suggestion.kind][lang]}
                  </span>
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-pencil">{suggestion.reason[lang]}</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-pencil">
                {formatPrice(salePrice(product))}
                {isOnSale(product) && <span className="ml-1 text-pen">{T.onSale[lang]}</span>}
              </span>
              <button
                type="button"
                onClick={() => onAdd(product.id)}
                aria-label={`${T.add[lang]} ${product.name[lang]}`}
                className="h-7 w-7 shrink-0 rounded-full font-mono text-base leading-none text-pencil transition hover:bg-pen-soft hover:text-pen"
              >
                +
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
