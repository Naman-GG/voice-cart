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

/** Enough blank rules below the last item that the sheet still reads as paper. */
const MIN_RULES = 8;

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
  const total = estimatedTotal(pending);
  const rowCount = groups.reduce((sum, group) => sum + group.items.length + 1, 0);

  return (
    <section aria-label={T.yourList[lang]}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 pb-2 pt-5">
        <h2 className="label text-ink">{T.yourList[lang]}</h2>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] text-pencil">
            {pending.length} {T.items[lang]}
            {items.length > pending.length && ` · ${items.length - pending.length} ${T.bought[lang]}`}
            {total > 0 && ` · ${formatPrice(total)}`}
          </p>
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="font-mono text-[11px] text-pencil underline-offset-4 transition hover:text-pen hover:underline"
            >
              {T.undo[lang]}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[11px] text-pencil underline-offset-4 transition hover:text-erase hover:underline"
            >
              {T.clearAll[lang]}
            </button>
          )}
        </div>
      </header>

      <div
        className="ruled relative"
        style={{ minHeight: `calc(var(--rule-step) * ${Math.max(MIN_RULES, rowCount + 2)})` }}
      >
        {items.length === 0 ? (
          <p className="rule-row pl-[calc(var(--margin-x)+1rem)] pr-5 text-sm text-pencil">
            {T.emptyHint[lang]}
          </p>
        ) : (
          <ul>
            {groups.map((group) => (
              <li key={group.category}>
                <p className="rule-row label pl-[calc(var(--margin-x)+1rem)] pr-5">
                  {CATEGORIES[group.category].label[lang]}
                </p>
                <ul>
                  {group.items.map((item) => {
                    const product = getProduct(item.productId);
                    const name = product ? product.name[lang] : item.name;
                    const meta = [quantityLabel(item, lang), item.brand, item.notes].filter(Boolean).join(" · ");
                    const swaps = item.productId ? substitutesFor(item.productId) : [];
                    const isOpen = openSwap === item.id;

                    return (
                      <li key={item.id} className="animate-write">
                        <div className="rule-row group gap-3 pr-4">
                          {/* Quantity, written in the margin like a real list. */}
                          <span
                            className={`w-[var(--margin-x)] shrink-0 pr-3 text-right font-mono text-sm tabular-nums ${
                              item.checked ? "text-pencil" : "text-ink"
                            }`}
                          >
                            {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)}
                          </span>

                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={item.checked}
                            onClick={() => onToggle(item.id)}
                            className="flex min-w-0 flex-1 items-baseline gap-2 pl-1 text-left"
                          >
                            <span
                              className={`truncate text-[15px] ${
                                item.checked ? "struck" : "text-ink decoration-pencil/50 underline-offset-4 group-hover:underline"
                              }`}
                            >
                              {name}
                            </span>
                            {meta && <span className="truncate font-mono text-[11px] text-pencil">{meta}</span>}
                          </button>

                          {product && (
                            <span className="shrink-0 font-mono text-[11px] tabular-nums text-pencil">
                              {formatPrice(salePrice(product))}
                            </span>
                          )}

                          <span className="flex shrink-0 items-center opacity-70 transition group-hover:opacity-100">
                            <IconButton label="Decrease quantity" onClick={() => onQuantity(item.id, -1)}>
                              −
                            </IconButton>
                            <IconButton label="Increase quantity" onClick={() => onQuantity(item.id, 1)}>
                              +
                            </IconButton>
                            {swaps.length > 0 && (
                              <IconButton
                                label={`${T.swap[lang]} ${name}`}
                                expanded={isOpen}
                                onClick={() => setOpenSwap(isOpen ? null : item.id)}
                                className="hidden sm:block"
                              >
                                ⇄
                              </IconButton>
                            )}
                            <IconButton label={`Remove ${name}`} danger onClick={() => onRemove(item.id)}>
                              ×
                            </IconButton>
                          </span>
                        </div>

                        {isOpen && swaps.length > 0 && (
                          <div className="animate-write flex flex-wrap gap-x-4 gap-y-1 pb-2 pl-[calc(var(--margin-x)+1rem)] pr-5">
                            {swaps.map((swap) => (
                              <button
                                key={swap.id}
                                type="button"
                                onClick={() => {
                                  onAddProduct(swap.id);
                                  onRemove(item.id);
                                  setOpenSwap(null);
                                }}
                                className="font-mono text-[11px] text-pen underline-offset-4 hover:underline"
                              >
                                {swap.name[lang]} {formatPrice(salePrice(swap))}
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
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
  expanded,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={`h-7 w-7 rounded-full font-mono text-sm leading-none text-pencil transition hover:bg-pen-soft ${
        danger ? "hover:text-erase" : "hover:text-pen"
      } ${className}`}
    >
      {children}
    </button>
  );
}
