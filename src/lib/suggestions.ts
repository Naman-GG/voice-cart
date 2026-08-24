import { CATALOG, getProduct } from "./catalog";
import type { HistoryEntry, ListItem, Product, Suggestion } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Items worth suggesting to a brand-new user with no history yet. */
const STARTER_IDS = ["milk", "bread", "eggs", "onion", "rice", "tea"];

interface SuggestionInput {
  list: ListItem[];
  history: HistoryEntry[];
  /** Injected so the engine stays pure and testable. */
  now?: number;
  limit?: number;
}

function daysSince(timestamp: number, now: number): number {
  return (now - timestamp) / DAY_MS;
}

function make(
  product: Product,
  kind: Suggestion["kind"],
  reason: Suggestion["reason"],
  score: number,
): Suggestion {
  return { id: `${kind}:${product.id}`, productId: product.id, kind, reason, score };
}

/**
 * Blends four signals into one ranked list:
 * repurchase history, current season, substitutes and complements.
 */
export function buildSuggestions({ list, history, now = Date.now(), limit = 6 }: SuggestionInput): Suggestion[] {
  const month = new Date(now).getMonth() + 1;
  const onList = new Set(list.filter((item) => !item.checked).map((item) => item.productId));
  const suggestions = new Map<string, Suggestion>();

  const add = (suggestion: Suggestion | null) => {
    if (!suggestion) return;
    if (onList.has(suggestion.productId)) return;
    const existing = suggestions.get(suggestion.productId);
    if (!existing || existing.score < suggestion.score) suggestions.set(suggestion.productId, suggestion);
  };

  // 1. Repurchase cadence — "you're probably running low".
  for (const entry of history) {
    const product = getProduct(entry.productId);
    if (!product) continue;
    const lastAdded = entry.addedAt[entry.addedAt.length - 1];
    if (!lastAdded) continue;
    const elapsed = daysSince(lastAdded, now);
    const cadence = averageGap(entry) ?? product.repurchaseDays;
    if (!cadence) continue;
    if (elapsed < cadence * 0.75) continue;
    const overdue = elapsed / cadence;
    add(
      make(product, "history", {
        en: `Looks like you're running low on ${product.name.en} — last added ${Math.round(elapsed)} days ago.`,
        hi: `लगता है ${product.name.hi} खत्म हो रहा है — ${Math.round(elapsed)} दिन पहले लिया था।`,
      }, 3 + Math.min(overdue, 3) + Math.min(entry.purchases, 5) * 0.2),
    );
  }

  // 2. Seasonal picks.
  for (const product of CATALOG) {
    if (!product.seasonMonths?.includes(month)) continue;
    add(
      make(product, "seasonal", {
        en: `${capitalize(product.name.en)}: in season right now.`,
        hi: `${product.name.hi} अभी मौसम में है।`,
      }, 1.6 + (product.category === "produce" ? 0.4 : 0)),
    );
  }

  // 3. Substitutes for what is already on the list.
  for (const item of list) {
    const product = getProduct(item.productId);
    if (!product || item.checked) continue;
    for (const substituteId of product.substitutes ?? []) {
      const substitute = getProduct(substituteId);
      if (!substitute) continue;
      add(
        make(substitute, "substitute", {
          en: `Prefer an alternative to ${product.name.en}? Try ${substitute.name.en}.`,
          hi: `${product.name.hi} की जगह ${substitute.name.hi} लेना चाहेंगे?`,
        }, 2.4),
      );
    }
  }

  // 4. Complements — things usually bought together.
  for (const item of list) {
    const product = getProduct(item.productId);
    if (!product || item.checked) continue;
    for (const pairId of product.goesWith ?? []) {
      const pair = getProduct(pairId);
      if (!pair) continue;
      add(
        make(pair, "complement", {
          en: `${capitalize(pair.name.en)} goes well with ${product.name.en}.`,
          hi: `${product.name.hi} के साथ ${pair.name.hi} भी लोगे?`,
        }, 2.0),
      );
    }
  }

  // 5. Cold start.
  if (!history.length && !list.length) {
    for (const id of STARTER_IDS) {
      const product = getProduct(id);
      if (product) {
        add(make(product, "starter", {
          en: `Most lists start with ${product.name.en}.`,
          hi: `ज़्यादातर लिस्ट ${product.name.hi} से शुरू होती है।`,
        }, 1.2));
      }
    }
  }

  const ranked = Array.from(suggestions.values()).sort(
    (a, b) => b.score - a.score || a.productId.localeCompare(b.productId),
  );
  return diversify(ranked, limit);
}

/**
 * Interleaves the ranked list so one signal cannot fill the whole rail —
 * a shopper is better served by two substitutes plus a seasonal pick than
 * by six substitutes for the same product.
 */
function diversify(ranked: Suggestion[], limit: number, perKind = 2): Suggestion[] {
  const counts = new Map<Suggestion["kind"], number>();
  const picked: Suggestion[] = [];
  const overflow: Suggestion[] = [];

  for (const suggestion of ranked) {
    const used = counts.get(suggestion.kind) ?? 0;
    if (used < perKind) {
      counts.set(suggestion.kind, used + 1);
      picked.push(suggestion);
    } else {
      overflow.push(suggestion);
    }
    if (picked.length === limit) return picked;
  }
  return [...picked, ...overflow].slice(0, limit);
}

/** Mean interval between past additions, used in place of the catalog default. */
function averageGap(entry: HistoryEntry): number | null {
  if (entry.addedAt.length < 2) return null;
  const sorted = [...entry.addedAt].sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) total += sorted[i] - sorted[i - 1];
  const gap = total / (sorted.length - 1) / DAY_MS;
  return gap > 0.5 ? gap : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Substitutes shown when a specific item is tapped or unavailable. */
export function substitutesFor(productId: string): Product[] {
  const product = getProduct(productId);
  if (!product) return [];
  return (product.substitutes ?? [])
    .map((id) => getProduct(id))
    .filter((item): item is Product => Boolean(item));
}

export function seasonalHighlights(now = Date.now(), limit = 8): Product[] {
  const month = new Date(now).getMonth() + 1;
  return CATALOG.filter((product) => product.seasonMonths?.includes(month)).slice(0, limit);
}
