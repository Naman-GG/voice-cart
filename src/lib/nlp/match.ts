import { ALIAS_INDEX, MAX_ALIAS_WORDS, PRODUCTS_BY_ID } from "../catalog";
import type { Product } from "../types";
import { editDistance, normalize, singularize } from "./normalize";

export interface ProductMatch {
  product: Product;
  /** Token index range consumed by the match, end-exclusive. */
  start: number;
  end: number;
  /** 1 for an exact alias hit, lower for a fuzzy (speech-slip) hit. */
  confidence: number;
}

const ALIAS_KEYS = Array.from(ALIAS_INDEX.keys());

function lookup(phrase: string): string | undefined {
  return (
    ALIAS_INDEX.get(phrase) ??
    ALIAS_INDEX.get(phrase.split(" ").map(singularize).join(" "))
  );
}

/**
 * Finds the catalog product mentioned in `tokens`, preferring the longest
 * exact alias phrase and falling back to a bounded fuzzy match so that
 * transcription slips ("tomatos", "shampu") still resolve.
 */
export function matchProduct(tokens: string[]): ProductMatch | null {
  const maxSpan = Math.min(MAX_ALIAS_WORDS, tokens.length);

  for (let span = maxSpan; span >= 1; span -= 1) {
    for (let start = 0; start + span <= tokens.length; start += 1) {
      const phrase = tokens.slice(start, start + span).join(" ");
      const id = lookup(phrase);
      if (id) {
        const product = PRODUCTS_BY_ID.get(id);
        if (product) return { product, start, end: start + span, confidence: 1 };
      }
    }
  }

  let best: ProductMatch | null = null;
  for (let start = 0; start < tokens.length; start += 1) {
    for (let span = 1; span <= Math.min(2, tokens.length - start); span += 1) {
      const phrase = tokens.slice(start, start + span).join(" ");
      if (phrase.length < 4) continue;
      const tolerance = phrase.length <= 6 ? 1 : 2;
      for (const key of ALIAS_KEYS) {
        if (Math.abs(key.length - phrase.length) > tolerance) continue;
        const distance = editDistance(phrase, key, tolerance);
        if (distance > tolerance) continue;
        const confidence = 1 - distance / (phrase.length + 1);
        if (!best || confidence > best.confidence) {
          const product = PRODUCTS_BY_ID.get(ALIAS_INDEX.get(key)!);
          if (product) best = { product, start, end: start + span, confidence };
        }
      }
    }
  }
  return best;
}

/** Matches a product from a raw string (used by search and quick-add chips). */
export function matchProductInText(text: string): Product | null {
  const tokens = normalize(text).split(" ").filter(Boolean);
  return tokens.length ? matchProduct(tokens)?.product ?? null : null;
}
