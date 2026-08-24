import { describe, expect, it } from "vitest";
import {
  buildSuggestions,
  frequentlyBought,
  nextIdleNudge,
  seasonalHighlights,
  substitutesFor,
} from "@/lib/suggestions";
import type { HistoryEntry, ListItem } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2025-12-15T10:00:00Z").getTime();

function listItem(productId: string, overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: productId,
    productId,
    name: productId,
    category: "other",
    quantity: 1,
    unit: "piece",
    checked: false,
    addedAt: NOW,
    ...overrides,
  };
}

describe("smart suggestions", () => {
  it("flags items that are due for a repurchase", () => {
    const history: HistoryEntry[] = [{ productId: "bread", addedAt: [NOW - 10 * DAY], purchases: 4 }];
    const suggestions = buildSuggestions({ list: [], history, now: NOW });
    const bread = suggestions.find((entry) => entry.productId === "bread");
    expect(bread?.kind).toBe("history");
    expect(bread?.reason.en).toMatch(/running low/i);
  });

  it("does not nag about items bought recently", () => {
    const history: HistoryEntry[] = [{ productId: "bread", addedAt: [NOW - DAY], purchases: 4 }];
    const suggestions = buildSuggestions({ list: [], history, now: NOW });
    expect(suggestions.find((entry) => entry.productId === "bread")?.kind).not.toBe("history");
  });

  it("never suggests something already on the list", () => {
    const history: HistoryEntry[] = [{ productId: "bread", addedAt: [NOW - 30 * DAY], purchases: 4 }];
    const suggestions = buildSuggestions({ list: [listItem("bread")], history, now: NOW });
    expect(suggestions.some((entry) => entry.productId === "bread")).toBe(false);
  });

  it("surfaces items that are in season", () => {
    const suggestions = buildSuggestions({ list: [], history: [], now: NOW, limit: 40 });
    expect(suggestions.filter((entry) => entry.kind === "seasonal").length).toBeGreaterThan(0);
    expect(seasonalHighlights(NOW).map((product) => product.id)).toContain("carrot");
  });

  it("offers substitutes for what is on the list", () => {
    const suggestions = buildSuggestions({ list: [listItem("milk")], history: [], now: NOW, limit: 40 });
    const swap = suggestions.find((entry) => entry.productId === "almond-milk");
    expect(swap?.kind).toBe("substitute");
    expect(swap?.reason.en).toMatch(/almond milk/i);
  });

  it("offers complements for what is on the list", () => {
    const suggestions = buildSuggestions({ list: [listItem("pasta")], history: [], now: NOW, limit: 40 });
    expect(suggestions.some((entry) => entry.productId === "pasta-sauce" && entry.kind === "complement")).toBe(true);
  });

  it("cold starts with popular staples", () => {
    const suggestions = buildSuggestions({ list: [], history: [], now: NOW, limit: 40 });
    expect(suggestions.some((entry) => entry.kind === "starter")).toBe(true);
  });

  it("exposes direct substitutes for a product", () => {
    expect(substitutesFor("milk").map((product) => product.id)).toContain("soy-milk");
    expect(substitutesFor("nonexistent")).toEqual([]);
  });

  it("mixes suggestion kinds instead of flooding one signal", () => {
    const suggestions = buildSuggestions({
      list: [listItem("milk"), listItem("apple")],
      history: [],
      now: NOW,
      limit: 6,
    });
    const kinds = new Set(suggestions.map((entry) => entry.kind));
    expect(kinds.size).toBeGreaterThan(1);
    const substitutes = suggestions.filter((entry) => entry.kind === "substitute");
    expect(substitutes.length).toBeLessThanOrEqual(2);
  });

  it("respects the result limit", () => {
    expect(buildSuggestions({ list: [], history: [], now: NOW, limit: 3 })).toHaveLength(3);
  });

  it("learns cadence from repeated purchases", () => {
    const history: HistoryEntry[] = [
      { productId: "rice", addedAt: [NOW - 12 * DAY, NOW - 8 * DAY, NOW - 4 * DAY], purchases: 3 },
    ];
    // Catalog cadence for rice is 30 days, but this shopper buys it every 4.
    const suggestions = buildSuggestions({ list: [], history, now: NOW, limit: 40 });
    expect(suggestions.some((entry) => entry.productId === "rice" && entry.kind === "history")).toBe(true);
  });
});

describe("proactive idle prompts", () => {
  const history: HistoryEntry[] = [
    { productId: "milk", addedAt: [NOW - 5 * DAY], purchases: 9 },
    { productId: "bread", addedAt: [NOW - 6 * DAY], purchases: 4 },
  ];

  it("ranks the shopper's most frequent purchases first", () => {
    expect(frequentlyBought([], history).map((product) => product.id).slice(0, 2)).toEqual(["milk", "bread"]);
  });

  it("skips items already on the list", () => {
    const ids = frequentlyBought([listItem("milk")], history).map((product) => product.id);
    expect(ids).not.toContain("milk");
    expect(ids[0]).toBe("bread");
  });

  it("falls back to staples for a first-time shopper", () => {
    expect(frequentlyBought([], []).length).toBeGreaterThan(0);
  });

  it("favours the most frequent item when the draw is low", () => {
    // milk has 9 purchases against bread's 4, so it owns the front of the
    // weighted range: a near-zero draw must land on it.
    const first = nextIdleNudge([], history, [], new Set(), () => 0);
    expect(first?.productId).toBe("milk");
    expect(first?.reason.en).toMatch(/usually buy/i);
  });

  it("never repeats an item that was already offered", () => {
    const offered = new Set(["milk"]);
    const next = nextIdleNudge([], history, [], offered, () => 0);
    expect(next?.productId).not.toBe("milk");
  });

  it("does not offer the same item every session", () => {
    // The old version was deterministic and always suggested bread.
    const picks = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const draw = i / 12;
      const nudge = nextIdleNudge([], [], [], new Set(), () => draw);
      if (nudge) picks.add(nudge.productId);
    }
    expect(picks.size).toBeGreaterThan(3);
  });

  it("still weights a heavy buyer above a light one across many draws", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 200; i += 1) {
      const nudge = nextIdleNudge([], history, [], new Set(), () => i / 200);
      if (nudge) counts[nudge.productId] = (counts[nudge.productId] ?? 0) + 1;
    }
    expect(counts.milk).toBeGreaterThan(counts.bread ?? 0);
  });

  it("falls back to the recommender once frequent items run out", () => {
    const offered = new Set(frequentlyBought([], []).map((product) => product.id));
    const suggestions = buildSuggestions({ list: [], history: [], now: NOW, limit: 40 });
    const nudge = nextIdleNudge([], [], suggestions, offered);
    expect(nudge === null || !offered.has(nudge.productId)).toBe(true);
  });
});
