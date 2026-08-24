import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/nlp/parser";
import {
  estimatedTotal,
  groupByCategory,
  initialState,
  reducer,
  type AppState,
} from "@/lib/store";

const AT = 1_700_000_000_000;

function run(state: AppState, utterance: string, at = AT): AppState {
  return reducer(state, { type: "command", command: parseCommand(utterance, state.lang), at });
}

describe("list management via voice", () => {
  it("adds, categorises and totals items", () => {
    let state = run(initialState, "add 2 litres of milk");
    state = run(state, "I need apples");

    expect(state.items).toHaveLength(2);
    expect(state.items[0]).toMatchObject({ productId: "milk", quantity: 2, unit: "l", category: "dairy" });
    expect(state.items[1].category).toBe("produce");
    expect(estimatedTotal(state.items)).toBeGreaterThan(0);

    const groups = groupByCategory(state.items);
    expect(groups.map((group) => group.category)).toEqual(["produce", "dairy"]);
  });

  it("merges repeat additions of the same product", () => {
    let state = run(initialState, "add 2 bottles of water");
    state = run(state, "add 3 bottles of water");
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(5);
  });

  it("removes items and warns about ones not on the list", () => {
    let state = run(initialState, "add milk");
    state = run(state, "remove milk from my list");
    expect(state.items).toHaveLength(0);
    expect(state.feedback?.tone).toBe("success");

    state = run(state, "remove bread");
    expect(state.feedback?.tone).toBe("warning");
  });

  it("marks items as bought without deleting them", () => {
    let state = run(initialState, "add eggs");
    state = run(state, "I bought the eggs");
    expect(state.items[0].checked).toBe(true);
    expect(state.items).toHaveLength(1);
  });

  it("updates a quantity", () => {
    let state = run(initialState, "add milk");
    state = run(state, "change milk to 4");
    expect(state.items[0].quantity).toBe(4);
  });

  it("clears the list and supports undo", () => {
    let state = run(initialState, "add bread and butter");
    expect(state.items).toHaveLength(2);
    state = run(state, "clear my list");
    expect(state.items).toHaveLength(0);
    state = reducer(state, { type: "undo" });
    expect(state.items).toHaveLength(2);
  });

  it("records a command log with intents", () => {
    const state = run(initialState, "add milk");
    expect(state.log[0]).toMatchObject({ intent: "add", tone: "success" });
  });

  it("keeps purchase history for the recommender", () => {
    let state = run(initialState, "add milk");
    state = run(state, "remove milk");
    state = run(state, "add milk");
    expect(state.history[0]).toMatchObject({ productId: "milk", purchases: 2 });
  });
});

describe("manual interactions", () => {
  it("adds a product from a suggestion tap", () => {
    const state = reducer(initialState, { type: "add-product", productId: "bread", at: AT });
    expect(state.items[0].productId).toBe("bread");
  });

  it("removes a row when the quantity drops to zero", () => {
    let state = reducer(initialState, { type: "add-product", productId: "bread", at: AT });
    state = reducer(state, { type: "change-quantity", rowId: "bread", delta: -1 });
    expect(state.items).toHaveLength(0);
  });

  it("toggles the bought state", () => {
    let state = reducer(initialState, { type: "add-product", productId: "bread", at: AT });
    state = reducer(state, { type: "toggle-row", rowId: "bread" });
    expect(state.items[0].checked).toBe(true);
  });
});

describe("responses", () => {
  it("replies in both languages", () => {
    const state = run(initialState, "add milk");
    expect(state.feedback?.message.en).toContain("milk");
    expect(state.feedback?.message.hi).toContain("दूध");
  });

  it("reads the list back", () => {
    let state = run(initialState, "add milk and bread");
    state = run(state, "what's on my list");
    expect(state.feedback?.message.en).toContain("2 items");
  });

  it("flags commands it cannot understand", () => {
    const state = run(initialState, "zzz qqq");
    expect(state.feedback?.tone).toBe("warning");
  });

  it("enters a loading state for searches", () => {
    const state = run(initialState, "find toothpaste under $5");
    expect(state.search?.loading).toBe(true);
    expect(state.search?.filters.maxPrice).toBe(5);
  });
});
