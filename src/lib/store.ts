import { CATEGORIES, getProduct } from "./catalog";
import { UNIT_LABELS } from "./nlp/lexicon";
import { normalize } from "./nlp/normalize";
import type { ParsedCommand, ParsedItem } from "./nlp/parser";
import { salePrice } from "./search";
import type {
  HistoryEntry,
  Lang,
  ListItem,
  SearchFilters,
  SearchResult,
  Unit,
} from "./types";

export type FeedbackTone = "success" | "info" | "warning" | "error";

export interface Feedback {
  tone: FeedbackTone;
  message: Record<Lang, string>;
}

export interface LogEntry {
  id: string;
  transcript: string;
  intent: string;
  tone: FeedbackTone;
  at: number;
}

export interface AppState {
  /** False until the saved list has been read back from localStorage. */
  hydrated: boolean;
  /** Clock reading taken at hydration; keeps suggestion ranking pure. */
  hydratedAt: number | null;
  items: ListItem[];
  history: HistoryEntry[];
  lang: Lang;
  speakReplies: boolean;
  feedback: Feedback | null;
  search: { filters: SearchFilters; results: SearchResult[]; loading: boolean } | null;
  log: LogEntry[];
  /** Single-step undo snapshot. */
  past: { items: ListItem[]; history: HistoryEntry[] } | null;
}

export type Action =
  | { type: "hydrate"; payload: Partial<AppState> }
  | { type: "command"; command: ParsedCommand; at: number }
  | { type: "add-product"; productId: string; at: number }
  | { type: "remove-row"; rowId: string }
  | { type: "toggle-row"; rowId: string }
  | { type: "change-quantity"; rowId: string; delta: number }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "set-lang"; lang: Lang }
  | { type: "set-speak"; value: boolean }
  | { type: "search-results"; filters: SearchFilters; results: SearchResult[]; feedback: Feedback }
  | { type: "set-feedback"; feedback: Feedback }
  | { type: "clear-search" }
  | { type: "dismiss-feedback" };

export const STORAGE_KEY = "voice-cart.state.v1";

export const initialState: AppState = {
  hydrated: false,
  hydratedAt: null,
  items: [],
  history: [],
  lang: "en",
  speakReplies: true,
  feedback: null,
  search: null,
  log: [],
  past: null,
};

function rowId(item: Pick<ParsedItem, "productId" | "name">): string {
  return item.productId ?? `custom:${normalize(item.name)}`;
}

function unitLabel(unit: Unit, lang: Lang): string {
  return UNIT_LABELS[unit][lang];
}

function itemLabel(item: ListItem, lang: Lang): string {
  const product = getProduct(item.productId);
  return product ? product.name[lang] : item.name;
}

/** Units that carry no information at quantity one — nobody says "1 g toothpaste". */
const IMPLIED_AT_ONE: ReadonlySet<Unit> = new Set(["piece", "g", "ml"]);

export function quantityLabel(item: ListItem, lang: Lang): string {
  const quantity = Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2);
  if (item.quantity === 1 && IMPLIED_AT_ONE.has(item.unit)) return "";
  return `${quantity} ${unitLabel(item.unit, lang)}`;
}

export function estimatedTotal(items: ListItem[]): number {
  return items.reduce((sum, item) => {
    const product = getProduct(item.productId);
    if (!product) return sum;
    const multiplier = item.unit === product.unit ? item.quantity : Math.max(item.quantity, 1);
    return sum + salePrice(product) * multiplier;
  }, 0);
}

function recordHistory(history: HistoryEntry[], productId: string | null, at: number): HistoryEntry[] {
  if (!productId) return history;
  const existing = history.find((entry) => entry.productId === productId);
  if (!existing) return [...history, { productId, addedAt: [at], purchases: 1 }];
  return history.map((entry) =>
    entry.productId === productId
      ? { ...entry, addedAt: [...entry.addedAt, at].slice(-12), purchases: entry.purchases + 1 }
      : entry,
  );
}

function addItem(items: ListItem[], parsed: ParsedItem, at: number): ListItem[] {
  const id = rowId(parsed);
  const existing = items.find((item) => item.id === id);
  if (!existing) {
    const next: ListItem = {
      id,
      productId: parsed.productId,
      name: parsed.name,
      category: parsed.category,
      quantity: parsed.quantity,
      unit: parsed.unit,
      brand: parsed.brand,
      notes: parsed.notes,
      checked: false,
      addedAt: at,
    };
    return [...items, next];
  }
  return items.map((item) =>
    item.id !== id
      ? item
      : {
          ...item,
          quantity: item.unit === parsed.unit ? item.quantity + parsed.quantity : parsed.quantity,
          unit: parsed.unit,
          brand: parsed.brand ?? item.brand,
          notes: parsed.notes ?? item.notes,
          checked: false,
        },
  );
}

/** Finds a list row for a parsed reference, tolerating loose name matches. */
function findRow(items: ListItem[], parsed: ParsedItem): ListItem | undefined {
  const id = rowId(parsed);
  const direct = items.find((item) => item.id === id);
  if (direct) return direct;
  const needle = normalize(parsed.name);
  return items.find(
    (item) => normalize(item.name).includes(needle) || needle.includes(normalize(item.name)),
  );
}

function joinNames(names: string[], lang: Lang): string {
  if (names.length <= 1) return names[0] ?? "";
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return lang === "hi" ? `${rest} और ${last}` : `${rest} and ${last}`;
}

function feedbackFor(tone: FeedbackTone, en: string, hi: string): Feedback {
  return { tone, message: { en, hi } };
}

const NOT_UNDERSTOOD = feedbackFor(
  "warning",
  "I didn't catch an item there. Try “add two litres of milk”.",
  "कोई चीज़ समझ नहीं आई। बोलिए “दो लीटर दूध जोड़ो”।",
);

interface CommandResult {
  items: ListItem[];
  history: HistoryEntry[];
  feedback: Feedback;
  search?: { filters: SearchFilters; results: SearchResult[]; loading: boolean } | null;
}

/**
 * Applies a parsed voice command to the list. Pure: takes the current
 * collections and returns new ones plus bilingual spoken feedback.
 */
export function applyCommand(state: AppState, command: ParsedCommand, at: number): CommandResult {
  let items = state.items;
  let history = state.history;

  switch (command.intent) {
    case "add": {
      if (!command.items.length) return { items, history, feedback: NOT_UNDERSTOOD };
      const added: Record<Lang, string[]> = { en: [], hi: [] };
      for (const parsed of command.items) {
        items = addItem(items, parsed, at);
        history = recordHistory(history, parsed.productId, at);
        const row = items.find((item) => item.id === rowId(parsed))!;
        for (const lang of ["en", "hi"] as Lang[]) {
          const quantity = quantityLabel(row, lang);
          added[lang].push(quantity ? `${quantity} ${itemLabel(row, lang)}` : itemLabel(row, lang));
        }
      }
      return {
        items,
        history,
        feedback: feedbackFor(
          "success",
          `Added ${joinNames(added.en, "en")} to your list.`,
          `${joinNames(added.hi, "hi")} लिस्ट में जोड़ दिया।`,
        ),
      };
    }

    case "remove": {
      if (!command.items.length) return { items, history, feedback: NOT_UNDERSTOOD };
      const removed: Record<Lang, string[]> = { en: [], hi: [] };
      const missing: string[] = [];
      for (const parsed of command.items) {
        const row = findRow(items, parsed);
        if (!row) {
          missing.push(parsed.name);
          continue;
        }
        removed.en.push(itemLabel(row, "en"));
        removed.hi.push(itemLabel(row, "hi"));
        items = items.filter((item) => item.id !== row.id);
      }
      if (!removed.en.length) {
        return {
          items,
          history,
          feedback: feedbackFor(
            "warning",
            `${joinNames(missing, "en")} is not on your list.`,
            `${joinNames(missing, "hi")} लिस्ट में नहीं है।`,
          ),
        };
      }
      return {
        items,
        history,
        feedback: feedbackFor(
          "success",
          `Removed ${joinNames(removed.en, "en")}.`,
          `${joinNames(removed.hi, "hi")} हटा दिया।`,
        ),
      };
    }

    case "update_quantity": {
      const parsed = command.items[0];
      if (!parsed) return { items, history, feedback: NOT_UNDERSTOOD };
      const row = findRow(items, parsed);
      if (!row) {
        items = addItem(items, parsed, at);
        history = recordHistory(history, parsed.productId, at);
        return {
          items,
          history,
          feedback: feedbackFor(
            "success",
            `${parsed.name} wasn't on the list, so I added ${parsed.quantity}.`,
            `${parsed.name} लिस्ट में नहीं थी, ${parsed.quantity} जोड़ दी।`,
          ),
        };
      }
      items = items.map((item) =>
        item.id === row.id ? { ...item, quantity: parsed.quantity, unit: parsed.unit ?? item.unit } : item,
      );
      const updated = items.find((item) => item.id === row.id)!;
      return {
        items,
        history,
        feedback: feedbackFor(
          "success",
          `Updated ${itemLabel(updated, "en")} to ${quantityLabel(updated, "en") || "1"}.`,
          `${itemLabel(updated, "hi")} की मात्रा ${quantityLabel(updated, "hi") || "1"} कर दी।`,
        ),
      };
    }

    case "check":
    case "uncheck": {
      if (!command.items.length) return { items, history, feedback: NOT_UNDERSTOOD };
      const checked = command.intent === "check";
      const names: Record<Lang, string[]> = { en: [], hi: [] };
      for (const parsed of command.items) {
        const row = findRow(items, parsed);
        if (!row) continue;
        items = items.map((item) => (item.id === row.id ? { ...item, checked } : item));
        names.en.push(itemLabel(row, "en"));
        names.hi.push(itemLabel(row, "hi"));
      }
      if (!names.en.length) {
        return {
          items,
          history,
          feedback: feedbackFor("warning", "That item isn't on your list.", "वह चीज़ लिस्ट में नहीं है।"),
        };
      }
      return {
        items,
        history,
        feedback: checked
          ? feedbackFor("success", `Marked ${joinNames(names.en, "en")} as bought.`, `${joinNames(names.hi, "hi")} खरीदा हुआ मार्क कर दिया।`)
          : feedbackFor("success", `Moved ${joinNames(names.en, "en")} back to the list.`, `${joinNames(names.hi, "hi")} वापस लिस्ट में डाल दिया।`),
      };
    }

    case "clear": {
      if (!items.length) {
        return { items, history, feedback: feedbackFor("info", "Your list is already empty.", "लिस्ट पहले से खाली है।") };
      }
      const count = items.length;
      return {
        items: [],
        history,
        feedback: feedbackFor("success", `Cleared all ${count} items.`, `सभी ${count} चीज़ें हटा दीं।`),
      };
    }

    case "search": {
      const filters = command.filters ?? { query: command.transcript };
      const label = filters.query || command.transcript;
      // Results arrive from /api/search; show the panel in its loading state.
      return {
        items,
        history,
        search: { filters, results: [], loading: true },
        feedback: feedbackFor("info", `Searching for ${label}…`, `${label} खोज रहे हैं…`),
      };
    }

    case "read": {
      const pending = items.filter((item) => !item.checked);
      if (!pending.length) {
        return { items, history, feedback: feedbackFor("info", "Your list is empty.", "आपकी लिस्ट खाली है।") };
      }
      const spoken: Record<Lang, string[]> = { en: [], hi: [] };
      for (const item of pending) {
        for (const lang of ["en", "hi"] as Lang[]) {
          const quantity = quantityLabel(item, lang);
          spoken[lang].push(quantity ? `${quantity} ${itemLabel(item, lang)}` : itemLabel(item, lang));
        }
      }
      return {
        items,
        history,
        feedback: feedbackFor(
          "info",
          `You have ${pending.length} items: ${joinNames(spoken.en, "en")}.`,
          `आपकी लिस्ट में ${pending.length} चीज़ें हैं: ${joinNames(spoken.hi, "hi")}।`,
        ),
      };
    }

    case "help":
      return {
        items,
        history,
        feedback: feedbackFor(
          "info",
          "You can say: add two litres of milk, remove bread, find toothpaste under $5, or what's on my list.",
          "आप बोल सकते हैं: दो लीटर दूध जोड़ो, ब्रेड हटा दो, टूथपेस्ट ढूंढो, या लिस्ट में क्या है।",
        ),
      };

    case "undo":
      return { items, history, feedback: feedbackFor("info", "Undoing the last change.", "पिछला बदलाव वापस कर रहे हैं।") };

    default:
      return {
        items,
        history,
        feedback: feedbackFor(
          "warning",
          `I didn't understand “${command.transcript}”. Say “help” for examples.`,
          `“${command.transcript}” समझ नहीं आया। उदाहरण के लिए “मदद” बोलें।`,
        ),
      };
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.payload, hydrated: true };

    case "command": {
      if (action.command.intent === "undo") {
        return reducer(state, { type: "undo" });
      }
      const snapshot = { items: state.items, history: state.history };
      const result = applyCommand(state, action.command, action.at);
      const mutates = result.items !== state.items || result.history !== state.history;
      return {
        ...state,
        items: result.items,
        history: result.history,
        feedback: result.feedback,
        search: result.search !== undefined ? result.search : state.search,
        past: mutates ? snapshot : state.past,
        log: [
          {
            id: `${action.at}-${state.log.length}`,
            transcript: action.command.transcript,
            intent: action.command.intent,
            tone: result.feedback.tone,
            at: action.at,
          },
          ...state.log,
        ].slice(0, 25),
      };
    }

    case "add-product": {
      const product = getProduct(action.productId);
      if (!product) return state;
      const parsed: ParsedItem = {
        productId: product.id,
        name: product.name.en,
        category: product.category,
        quantity: 1,
        unit: product.unit,
        confidence: 1,
      };
      return {
        ...state,
        past: { items: state.items, history: state.history },
        items: addItem(state.items, parsed, action.at),
        history: recordHistory(state.history, product.id, action.at),
        feedback: feedbackFor(
          "success",
          `Added ${product.name.en} to your list.`,
          `${product.name.hi} लिस्ट में जोड़ दिया।`,
        ),
      };
    }

    case "remove-row":
      return {
        ...state,
        past: { items: state.items, history: state.history },
        items: state.items.filter((item) => item.id !== action.rowId),
        feedback: null,
      };

    case "toggle-row":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.rowId ? { ...item, checked: !item.checked } : item,
        ),
      };

    case "change-quantity":
      return {
        ...state,
        items: state.items.flatMap((item) => {
          if (item.id !== action.rowId) return [item];
          const quantity = Number((item.quantity + action.delta).toFixed(2));
          return quantity <= 0 ? [] : [{ ...item, quantity }];
        }),
      };

    case "clear":
      return {
        ...state,
        past: { items: state.items, history: state.history },
        items: [],
        feedback: feedbackFor("success", "Cleared your list.", "लिस्ट खाली कर दी।"),
      };

    case "undo":
      if (!state.past) {
        return { ...state, feedback: feedbackFor("info", "Nothing to undo.", "वापस करने के लिए कुछ नहीं है।") };
      }
      return {
        ...state,
        items: state.past.items,
        history: state.past.history,
        past: null,
        feedback: feedbackFor("success", "Reverted the last change.", "पिछला बदलाव वापस कर दिया।"),
      };

    case "set-lang":
      return { ...state, lang: action.lang };

    case "set-speak":
      return { ...state, speakReplies: action.value };

    case "search-results":
      return {
        ...state,
        search: { filters: action.filters, results: action.results, loading: false },
        feedback: action.feedback,
      };

    case "set-feedback":
      return { ...state, feedback: action.feedback };

    case "clear-search":
      return { ...state, search: null };

    case "dismiss-feedback":
      return { ...state, feedback: null };

    default:
      return state;
  }
}

/** Groups the list by aisle so the UI can render tidy sections. */
export function groupByCategory(items: ListItem[]): { category: ListItem["category"]; items: ListItem[] }[] {
  const groups = new Map<ListItem["category"], ListItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.category);
    if (bucket) bucket.push(item);
    else groups.set(item.category, [item]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => CATEGORIES[a[0]].order - CATEGORIES[b[0]].order)
    .map(([category, grouped]) => ({ category, items: grouped }));
}

export function loadPersisted(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lang: parsed.lang === "hi" ? "hi" : "en",
      speakReplies: parsed.speakReplies !== false,
    };
  } catch (error) {
    console.warn("Could not restore saved list", error);
    return null;
  }
}

export function persist(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: state.items,
        history: state.history,
        lang: state.lang,
        speakReplies: state.speakReplies,
      }),
    );
  } catch (error) {
    console.warn("Could not save list", error);
  }
}
