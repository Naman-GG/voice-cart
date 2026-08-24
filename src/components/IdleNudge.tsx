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

/**
 * The proactive card shown when the assistant offers something out loud
 * after a stretch of silence. Answerable by voice ("yes"/"no") or by tap.
 */
export function IdleNudge({ nudge, lang, onAccept, onDismiss }: Props) {
  const product = getProduct(nudge.productId);
  if (!product) return null;

  return (
    <section
      aria-live="polite"
      className="animate-rise rounded-3xl border border-accent/50 bg-accent-soft px-5 py-4 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {T.suggestions[lang]}
          </p>
          <p className="mt-1 text-sm font-medium text-text">{nudge.reason[lang]}</p>
          <p className="mt-0.5 text-xs text-text-muted">{formatPrice(salePrice(product))}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-text-muted transition hover:text-text"
          >
            {T.notNow[lang]}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-105 active:scale-95"
          >
            + {T.addIt[lang]}
          </button>
        </div>
      </div>
    </section>
  );
}
