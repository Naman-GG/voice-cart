import { describe, expect, it } from "vitest";
import { getProduct } from "@/lib/catalog";
import { parseCommand } from "@/lib/nlp/parser";
import { isOnSale, salePrice, searchCatalog } from "@/lib/search";

function searchFor(utterance: string) {
  const command = parseCommand(utterance);
  expect(command.intent).toBe("search");
  return searchCatalog(command.filters!);
}

describe("voice-activated search", () => {
  it("finds an item by name", () => {
    expect(searchFor("find toothpaste")[0].product.id).toBe("toothpaste");
  });

  it("respects a spoken price ceiling", () => {
    const results = searchFor("find toothpaste under $5");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.price <= 5)).toBe(true);
  });

  it("returns nothing when the ceiling is impossible", () => {
    expect(searchFor("find toothpaste under $1")).toHaveLength(0);
  });

  it("filters to organic products", () => {
    const results = searchFor("find me organic apples");
    expect(results.every((result) => result.product.organic)).toBe(true);
    expect(results.some((result) => result.product.id === "apple")).toBe(true);
  });

  it("filters by brand", () => {
    const results = searchFor("find Colgate toothpaste");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.matchedBrand === "Colgate")).toBe(true);
  });

  it("applies a price range", () => {
    const results = searchFor("show me juice between $2 and $4");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.price >= 2 && result.price <= 4)).toBe(true);
  });

  it("includes close alternatives to the query", () => {
    const ids = searchFor("find milk").map((result) => result.product.id);
    expect(ids).toContain("milk");
    expect(ids.some((id) => id === "almond-milk" || id === "soy-milk")).toBe(true);
  });

  it("discounts products that are on sale", () => {
    const discounted = ["milk", "bread", "apple", "rice", "tea", "eggs", "onion"]
      .map((id) => getProduct(id)!)
      .filter(isOnSale);
    for (const product of discounted) {
      expect(salePrice(product)).toBeLessThan(product.price);
    }
  });

  it("does not return unrelated products from the same aisle", () => {
    const ids = searchFor("find toothpaste under $5").map((result) => result.product.id);
    expect(ids).toContain("toothpaste");
    expect(ids).not.toContain("sanitary-pads");
    expect(ids).not.toContain("baby-wipes");
  });

  it("caps the number of results", () => {
    expect(searchCatalog({ query: "milk" }, 3).length).toBeLessThanOrEqual(3);
  });

  it("handles an empty query without throwing", () => {
    expect(() => searchCatalog({ query: "" })).not.toThrow();
  });
});
