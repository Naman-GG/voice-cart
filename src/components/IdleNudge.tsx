"use client";

import { getProduct } from "@/lib/catalog";
import { T, formatPrice } from "@/lib/i18n";
import { salePrice } from "@/lib/search";
import type { Lang, Suggestion } from "@/lib/types";

interface Props {
  nudge: Suggestion;
  lang: Lang;
  onAccept: () => void;
  onDismiss: () => void;
}

/** The assistant's own pencilled question, answerable by voice or by tap. */
export function IdleNudge({ nudge, lang, onAccept, onDismiss }: Props) {
  const product = getProduct(nudge.productId);
  if (!product) return null;

  return (
    <section aria-live="polite" className="animate-write border-l-2 border-pen pl-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-ink">{nudge.reason[lang]}</p>
        <span className="font-mono text-[11px] tabular-nums text-pencil">
          {formatPrice(salePrice(product))}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-4">
        <button
          type="button"
          onClick={onAccept}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-pen underline-offset-4 hover:underline"
        >
          {T.addIt[lang]}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-pencil underline-offset-4 hover:underline"
        >
          {T.notNow[lang]}
        </button>
      </div>
    </section>
  );
}
