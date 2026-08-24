/** Shared domain types for the Voice Command Shopping Assistant. */

export type Lang = "en" | "hi";

export type CategoryId =
  | "produce"
  | "dairy"
  | "bakery"
  | "meat"
  | "pantry"
  | "spices"
  | "snacks"
  | "beverages"
  | "frozen"
  | "household"
  | "personal"
  | "other";

export type Unit =
  | "piece"
  | "kg"
  | "g"
  | "l"
  | "ml"
  | "pack"
  | "dozen"
  | "bottle"
  | "can"
  | "loaf"
  | "bunch"
  | "box"
  | "bag";

export interface Product {
  id: string;
  /** Display name per supported language. */
  name: Record<Lang, string>;
  /** Every spoken form we accept: English, Devanagari and romanised Hindi. */
  aliases: string[];
  category: CategoryId;
  unit: Unit;
  /** Indicative price in USD for one `unit`. */
  price: number;
  brands: string[];
  sizes: string[];
  organic: boolean;
  /** 1-12. Present only for items with a real season. */
  seasonMonths?: number[];
  /** Product ids offered when the item is unavailable or on request. */
  substitutes?: string[];
  /** Product ids commonly bought together. */
  goesWith?: string[];
  /** Typical days between repurchases, drives "running low" nudges. */
  repurchaseDays?: number;
}

export interface ListItem {
  /** Stable row id (an item can appear once per product). */
  id: string;
  productId: string | null;
  /** Free-text name, used when the product is not in the catalog. */
  name: string;
  category: CategoryId;
  quantity: number;
  unit: Unit;
  brand?: string;
  /** e.g. "organic", "low fat" — captured from the utterance. */
  notes?: string;
  addedAt: number;
}

export interface HistoryEntry {
  productId: string;
  /** Timestamps of every time the item was added, newest last. */
  addedAt: number[];
  purchases: number;
}

export type SuggestionKind = "history" | "seasonal" | "substitute" | "complement" | "starter";

export interface Suggestion {
  id: string;
  productId: string;
  kind: SuggestionKind;
  /** Localised, human readable justification. */
  reason: Record<Lang, string>;
  score: number;
}

export interface SearchFilters {
  query: string;
  maxPrice?: number;
  minPrice?: number;
  brand?: string;
  organicOnly?: boolean;
  size?: string;
  category?: CategoryId;
}

export interface SearchResult {
  product: Product;
  matchedBrand?: string;
  price: number;
}
