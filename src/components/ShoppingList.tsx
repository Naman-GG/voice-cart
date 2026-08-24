"use client";

import { useState } from "react";
import { CATEGORIES, getProduct } from "@/lib/catalog";
import { T, formatPrice } from "@/lib/i18n";
import { salePrice } from "@/lib/search";
import { estimatedTotal, groupByCategory, quantityLabel } from "@/lib/store";
import { substitutesFor } from "@/lib/suggestions";
import type { Lang, ListItem } from "@/lib/types";

interface Props {
  items: ListItem[];
  lang: Lang;
  canUndo: boolean;
  onToggle: (rowId: string) => void;
  onRemove: (rowId: string) => void;
  onQuantity: (rowId: string, delta: number) => void;
  onAddProduct: (productId: string) => void;
  onClear: () => void;
  onUndo: () => void;
}

export function ShoppingList({
  items,
  lang,
  canUndo,
  onToggle,
  onRemove,
  onQuantity,
  onAddProduct,
  onClear,
  onUndo,
}: Props) {
  const [openSwap, setOpenSwap] = useState<string | null>(null);
  const pending = items.filter((item) => !item.checked);
  const groups = groupByCategory(items);
  const total = estimatedTotal(items.filter((item) => !item.checked));

  return (
    <section className="rounded-3xl border border-line bg-surface shadow-[var(--shadow)]" aria-label={T.yourList[lang]}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{T.yourList[lang]}</h2>
          <p className="text-xs text-text-muted">
            {pending.length} {T.items[lang]}
            {items.length > pending.length && ` · ${items.length - pending.length} ${T.bought[lang]}`}
            {total > 0 && ` · ${T.estimatedTotal[lang]} ${formatPrice(total)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-text-muted transition hover:text-text"
            >
              ↺ {T.undo[lang]}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10"
            >
              {T.clearAll[lang]}
            </button>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-text-muted">{T.emptyList[lang]}</p>
          <p className="mt-1 text-xs text-text-muted">{T.emptyHint[lang]}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]">
          {groups.map((group) => (
            <li key={group.category}>
              <p className="flex items-center gap-2 bg-surface-muted px-5 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <span aria-hidden>{CATEGORIES[group.category].emoji}</span>
                {CATEGORIES[group.category].label[lang]}
              </p>
              <ul>
                {group.items.map((item) => {
                  const product = getProduct(item.productId);
                  const quantity = quantityLabel(item, lang);
                  const swaps = item.productId ? substitutesFor(item.productId) : [];
                  const isOpen = openSwap === item.id;
                  return (
                    <li key={item.id} className="animate-rise px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.checked}
                          onClick={() => onToggle(item.id)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            item.checked ? "border-accent bg-accent text-[color:var(--accent-contrast)]" : "border-line"
                          }`}
                        >
                          {item.checked && <span className="text-xs">✓</span>}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${item.checked ? "text-text-muted line-through" : ""}`}>
                            {product ? product.name[lang] : item.name}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {[quantity, item.brand, item.notes].filter(Boolean).join(" · ")}
                            {product && ` · ${formatPrice(salePrice(product))}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => onQuantity(item.id, -1)}
                            className="h-7 w-7 rounded-full border border-line text-sm leading-none text-text-muted transition hover:text-text"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => onQuantity(item.id, 1)}
                            className="h-7 w-7 rounded-full border border-line text-sm leading-none text-text-muted transition hover:text-text"
                          >
                            +
                          </button>
                          {swaps.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOpenSwap(isOpen ? null : item.id)}
                              aria-expanded={isOpen}
                              className="ml-1 rounded-full border border-line px-2 py-1 text-[11px] text-text-muted transition hover:text-text"
                            >
                              ⇄ {T.swap[lang]}
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() => onRemove(item.id)}
                            className="h-7 w-7 rounded-full text-text-muted transition hover:bg-danger/10 hover:text-danger"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {isOpen && swaps.length > 0 && (
                        <div className="animate-rise mt-2 flex flex-wrap gap-2 pl-9">
                          {swaps.map((swap) => (
                            <button
                              key={swap.id}
                              type="button"
                              onClick={() => {
                                onAddProduct(swap.id);
                                onRemove(item.id);
                                setOpenSwap(null);
                              }}
                              className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-text transition hover:brightness-95"
                            >
                              {swap.name[lang]} · {formatPrice(salePrice(swap))}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
