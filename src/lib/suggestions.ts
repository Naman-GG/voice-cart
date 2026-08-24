import { CATALOG, getProduct } from "./catalog";
import type { HistoryEntry, ListItem, Product, Suggestion } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Items worth suggesting to a brand-new user with no history yet. */
const STARTER_IDS = [
  "milk", "bread", "eggs", "onion", "rice", "tea",
  "banana", "tomato", "potato", "sugar", "atta", "curd",
];

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
  const onList = new Set(list.map((item) => item.productId));
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
    if (!product) continue;
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
    if (!product) continue;
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

/**
 * Products this shopper buys most often, minus anything already on the list.
 * Falls back to popular staples for a first-time user.
 */
export function frequentlyBought(list: ListItem[], history: HistoryEntry[], limit = 6): Product[] {
  const onList = new Set(list.map((item) => item.productId));
  const ranked = [...history]
    .sort((a, b) => b.purchases - a.purchases || (b.addedAt.at(-1) ?? 0) - (a.addedAt.at(-1) ?? 0))
    .map((entry) => getProduct(entry.productId))
    .filter((product): product is Product => Boolean(product) && !onList.has(product!.id));

  if (ranked.length >= limit) return ranked.slice(0, limit);

  const fillers = STARTER_IDS.map((id) => getProduct(id)).filter(
    (product): product is Product =>
      Boolean(product) && !onList.has(product!.id) && !ranked.some((item) => item.id === product!.id),
  );
  return [...ranked, ...fillers].slice(0, limit);
}

/**
 * Weighted random pick: a product bought nine times is far likelier than one
 * bought once, but never certain. Without this the assistant offers the same
 * item every session — always bread — which reads as broken rather than smart.
 */
function weightedPick(products: Product[], history: HistoryEntry[], random: () => number): Product {
  const weights = products.map((product) => {
    const seen = history.find((entry) => entry.productId === product.id);
    return (seen?.purchases ?? 0) + 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let ticket = random() * total;
  for (let i = 0; i < products.length; i += 1) {
    ticket -= weights[i];
    if (ticket <= 0) return products[i];
  }
  return products[products.length - 1];
}

/**
 * Picks the single item to offer out loud after a stretch of silence.
 * Prefers what the shopper usually buys, then anything else the recommender
 * surfaced, and never repeats something already offered this session.
 *
 * `random` is injectable so the choice can be asserted in tests.
 */
export function nextIdleNudge(
  list: ListItem[],
  history: HistoryEntry[],
  suggestions: Suggestion[],
  alreadyOffered: ReadonlySet<string>,
  random: () => number = Math.random,
): Suggestion | null {
  const candidates = frequentlyBought(list, history, 8).filter(
    (product) => !alreadyOffered.has(product.id),
  );

  if (candidates.length) {
    const product = weightedPick(candidates, history, random);
    const seen = history.some((entry) => entry.productId === product.id);
    return {
      id: `idle:${product.id}`,
      productId: product.id,
      kind: "history",
      reason: seen
        ? {
            en: `You usually buy ${product.name.en}. Want it on the list?`,
            hi: `आप आमतौर पर ${product.name.hi} लेते हैं। लिस्ट में जोड़ूँ?`,
          }
        : {
            en: `Most lists include ${product.name.en}. Want it on the list?`,
            hi: `ज़्यादातर लिस्ट में ${product.name.hi} होता है। जोड़ूँ?`,
          },
      score: 0,
    };
  }

  const fresh = suggestions.filter((suggestion) => !alreadyOffered.has(suggestion.productId));
  if (!fresh.length) return null;
  return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
}
