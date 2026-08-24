import { ALL_BRANDS, getProduct } from "../catalog";
import type { CategoryId, Lang, SearchFilters, Unit } from "../types";
import {
  FILLER_WORDS,
  INTENT_PATTERNS,
  MODIFIER_WORDS,
  NUMBER_WORDS,
  PRICE_BETWEEN,
  PRICE_OVER,
  PRICE_TRAILING,
  PRICE_UNDER,
  SPLIT_PATTERN,
  UNIT_WORDS,
  type Intent,
} from "./lexicon";
import { matchProduct } from "./match";
import { hasDevanagari, normalize } from "./normalize";

export interface ParsedItem {
  productId: string | null;
  /** English/display label for the item. */
  name: string;
  category: CategoryId;
  quantity: number;
  unit: Unit;
  brand?: string;
  notes?: string;
  confidence: number;
}

export interface ParsedCommand {
  intent: Intent;
  lang: Lang;
  transcript: string;
  items: ParsedItem[];
  filters?: SearchFilters;
  /** 0-1 estimate of how sure we are about the whole interpretation. */
  confidence: number;
}

const ATTACHED_UNIT = /^(\d+(?:\.\d+)?)(kg|kgs|g|gm|gms|ml|l|ltr)$/;
const SIZE_PATTERN = /\b(\d+(?:\.\d+)?)\s*(ml|l|litre|liter|g|gm|kg)\b/;

function detectLang(text: string, fallback: Lang): Lang {
  return hasDevanagari(text) ? "hi" : fallback;
}

/** Finds the intent, then strips every command verb so only nouns remain. */
function detectIntent(text: string): { intent: Intent; rest: string } {
  let intent: Intent = "unknown";
  for (const { intent: candidate, patterns } of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      intent = candidate;
      break;
    }
  }

  let rest = text;
  if (intent !== "unknown") {
    for (const { patterns } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        rest = rest.replace(new RegExp(pattern.source, "g"), " ");
      }
    }
  }
  return { intent, rest: rest.replace(/\s+/g, " ").trim() };
}

function extractPriceFilters(text: string): { filters: Partial<SearchFilters>; rest: string } {
  const filters: Partial<SearchFilters> = {};
  let rest = text;

  const between = rest.match(PRICE_BETWEEN);
  if (between) {
    filters.minPrice = Number(between[1]);
    filters.maxPrice = Number(between[2]);
    rest = rest.replace(between[0], " ");
    return { filters, rest };
  }

  const under = rest.match(PRICE_UNDER);
  if (under) {
    filters.maxPrice = Number(under[1]);
    rest = rest.replace(under[0], " ");
  }

  const over = rest.match(PRICE_OVER);
  if (over) {
    filters.minPrice = Number(over[1]);
    rest = rest.replace(over[0], " ");
  }

  if (filters.maxPrice === undefined && filters.minPrice === undefined) {
    const trailing = rest.match(PRICE_TRAILING);
    if (trailing) {
      filters.maxPrice = Number(trailing[1]);
      rest = rest.replace(trailing[0], " ");
    }
  }
  return { filters, rest: rest.replace(/\s+/g, " ").trim() };
}

function extractBrand(text: string): { brand?: string; rest: string } {
  for (const brand of ALL_BRANDS) {
    const key = normalize(brand);
    if (key && text.includes(key)) {
      return { brand, rest: text.replace(key, " ").replace(/\s+/g, " ").trim() };
    }
  }
  return { rest: text };
}

interface QuantityResult {
  quantity?: number;
  unit?: Unit;
  rest: string[];
}

/**
 * Pulls a quantity and unit out of a token list.
 * Trailing bare numbers are ignored unless `allowTrailing` is set, so that
 * Hindi verb tails like "हटा दो" are not mistaken for the number two.
 */
function extractQuantity(tokens: string[], allowTrailing: boolean): QuantityResult {
  const rest = [...tokens];

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    const attached = token.match(ATTACHED_UNIT);
    if (attached) {
      rest.splice(i, 1);
      return { quantity: Number(attached[1]), unit: UNIT_WORDS[attached[2]], rest };
    }

    const numeric = /^\d+(?:\.\d+)?$/.test(token) ? Number(token) : NUMBER_WORDS[token];
    if (numeric === undefined || Number.isNaN(numeric)) continue;
    const isLast = i === rest.length - 1;
    if (isLast && !allowTrailing) continue;

    let consumed = 1;
    let unit: Unit | undefined;
    const next = rest[i + 1];
    if (next && UNIT_WORDS[next]) {
      unit = UNIT_WORDS[next];
      consumed = 2;
    }
    rest.splice(i, consumed);
    return { quantity: numeric, unit, rest };
  }

  // "a bottle of water" — a bare unit with no explicit count.
  for (let i = 0; i < rest.length; i += 1) {
    if (UNIT_WORDS[rest[i]]) {
      const unit = UNIT_WORDS[rest[i]];
      rest.splice(i, 1);
      return { quantity: undefined, unit, rest };
    }
  }
  return { rest };
}

function extractModifiers(tokens: string[]): { notes?: string; rest: string[] } {
  const notes: string[] = [];
  const rest: string[] = [];
  for (const token of tokens) {
    if (MODIFIER_WORDS.has(token)) notes.push(token);
    else rest.push(token);
  }
  return { notes: notes.length ? notes.join(" ") : undefined, rest };
}

function titleCase(text: string): string {
  return text.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

function parseSegment(segment: string, intent: Intent): ParsedItem | null {
  const { brand, rest: withoutBrand } = extractBrand(segment);
  let tokens = withoutBrand.split(" ").filter(Boolean);
  if (!tokens.length) return null;

  const quantityResult = extractQuantity(tokens, intent === "update_quantity");
  tokens = quantityResult.rest;

  const modifierResult = extractModifiers(tokens);
  tokens = modifierResult.rest.filter((token) => !FILLER_WORDS.has(token));
  if (!tokens.length) return null;

  const match = matchProduct(tokens);
  if (match) {
    const product = match.product;
    const spokenUnit = quantityResult.unit;
    const hasCount = quantityResult.quantity !== undefined;
    const weightish = product.unit === "kg" || product.unit === "g" || product.unit === "l" || product.unit === "ml" || product.unit === "dozen";
    const unit: Unit = spokenUnit ?? (hasCount && weightish ? "piece" : product.unit);
    return {
      productId: product.id,
      name: product.name.en,
      category: product.category,
      quantity: quantityResult.quantity ?? 1,
      unit,
      brand,
      notes: modifierResult.notes,
      confidence: match.confidence,
    };
  }

  const freeText = tokens.join(" ").trim();
  if (freeText.length < 2) return null;
  return {
    productId: null,
    name: titleCase(freeText),
    category: "other",
    quantity: quantityResult.quantity ?? 1,
    unit: quantityResult.unit ?? "piece",
    brand,
    notes: modifierResult.notes,
    confidence: 0.45,
  };
}

/**
 * Turns a raw voice transcript into a structured command.
 * Pure and synchronous, so it is trivially unit-testable and runs offline.
 */
export function parseCommand(transcript: string, defaultLang: Lang = "en"): ParsedCommand {
  const lang = detectLang(transcript, defaultLang);
  const text = normalize(transcript);

  if (!text) {
    return { intent: "unknown", lang, transcript, items: [], confidence: 0 };
  }

  const { intent: detected, rest: afterIntent } = detectIntent(text);
  const { filters: priceFilters, rest: afterPrice } = extractPriceFilters(afterIntent);

  const sizeMatch = detected === "search" ? afterPrice.match(SIZE_PATTERN) : null;
  const body = sizeMatch ? afterPrice.replace(sizeMatch[0], " ").trim() : afterPrice;

  const segments = body.split(SPLIT_PATTERN).map((part) => part.trim()).filter(Boolean);
  const items = segments
    .map((segment) => parseSegment(segment, detected))
    .filter((item): item is ParsedItem => item !== null);

  // A bare catalog product name ("bananas") is an implicit add. Unrecognised
  // words with no command verb stay "unknown" so we ask instead of guessing.
  let intent = detected;
  if (intent === "unknown" && items.some((item) => item.productId)) intent = "add";

  const filters: SearchFilters | undefined =
    intent === "search"
      ? {
          query: items[0]?.name ?? body,
          ...priceFilters,
          brand: items[0]?.brand,
          organicOnly: items.some((item) => item.notes?.includes("organic")),
          size: sizeMatch ? sizeMatch[0].replace(/\s+/g, " ").trim() : undefined,
          category: items[0]?.productId ? getProduct(items[0].productId)?.category : undefined,
        }
      : undefined;

  const itemConfidence = items.length
    ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
    : 0;
  const intentConfidence = detected === "unknown" ? 0.4 : 0.9;
  const needsItem = intent === "add" || intent === "remove" || intent === "check" || intent === "uncheck" || intent === "update_quantity";
  const confidence = needsItem
    ? Number(((intentConfidence + itemConfidence) / 2).toFixed(2))
    : intentConfidence;

  return { intent, lang, transcript, items, filters, confidence };
}

const AFFIRMATIVE = [
  /\b(yes|yeah|yep|yup|sure|okay|ok|please do|go ahead|add it|do it|of course)\b/,
  /(हाँ|हां|जी हाँ|जी|ठीक है|बिल्कुल|जोड़ दो|कर दो|हा)/,
];
const NEGATIVE = [
  /\b(no|nope|nah|not now|skip|later|never ?mind|dont|do not)\b/,
  /(नहीं|नही|ना|अभी नहीं|रहने दो|मत)/,
];

/**
 * Detects a bare yes/no reply, used when the assistant has just asked
 * whether to add something. Returns null for anything else so the
 * utterance falls through to the normal command parser.
 */
export function matchConfirmation(transcript: string): "yes" | "no" | null {
  const text = normalize(transcript);
  if (!text || text.split(" ").length > 4) return null;
  if (NEGATIVE.some((pattern) => pattern.test(text))) return "no";
  if (AFFIRMATIVE.some((pattern) => pattern.test(text))) return "yes";
  return null;
}
