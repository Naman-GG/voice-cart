import { describe, expect, it } from "vitest";
import { matchConfirmation, parseCommand } from "@/lib/nlp/parser";

const parse = (text: string, lang: "en" | "hi" = "en") => parseCommand(text, lang);

describe("English add commands", () => {
  it("handles the canonical add phrasing", () => {
    const result = parse("Add milk");
    expect(result.intent).toBe("add");
    expect(result.items[0].productId).toBe("milk");
    expect(result.items[0].quantity).toBe(1);
  });

  it("understands varied natural phrasings", () => {
    for (const phrase of [
      "I need apples",
      "I want to buy bananas",
      "add bananas to my list",
      "could you please pick up some bread",
      "I have to buy eggs",
      "grab a bottle of water",
    ]) {
      expect(parse(phrase).intent, phrase).toBe("add");
      expect(parse(phrase).items.length, phrase).toBeGreaterThan(0);
    }
  });

  it("treats a bare product name as an add", () => {
    const result = parse("tomatoes");
    expect(result.intent).toBe("add");
    expect(result.items[0].productId).toBe("tomato");
  });

  it("extracts numeric quantities and units", () => {
    const water = parse("Add 2 bottles of water");
    expect(water.items[0]).toMatchObject({ productId: "water", quantity: 2, unit: "bottle" });

    const oranges = parse("Buy 5 oranges");
    expect(oranges.items[0]).toMatchObject({ productId: "orange", quantity: 5, unit: "piece" });

    const rice = parse("add 2 kg rice");
    expect(rice.items[0]).toMatchObject({ productId: "rice", quantity: 2, unit: "kg" });

    const attached = parse("add 500g paneer");
    expect(attached.items[0]).toMatchObject({ productId: "paneer", quantity: 500, unit: "g" });
  });

  it("splits multi-item utterances", () => {
    const result = parse("add bread and butter and 6 eggs");
    expect(result.items.map((item) => item.productId)).toEqual(["bread", "butter", "eggs"]);
    expect(result.items[2].quantity).toBe(6);
  });

  it("keeps descriptors as notes and detects brands", () => {
    const result = parse("add organic apples");
    expect(result.items[0].productId).toBe("apple");
    expect(result.items[0].notes).toContain("organic");

    const branded = parse("add Amul butter");
    expect(branded.items[0].brand).toBe("Amul");
  });

  it("falls back to free text for unknown products", () => {
    const result = parse("add jackfruit chips wrapper");
    expect(result.items[0].productId === null || typeof result.items[0].productId === "string").toBe(true);
    expect(result.items.length).toBe(1);
  });

  it("tolerates speech-to-text slips", () => {
    expect(parse("add tomatos").items[0].productId).toBe("tomato");
    expect(parse("add shampu").items[0].productId).toBe("shampoo");
  });
});

describe("Other English intents", () => {
  it("removes items", () => {
    const result = parse("Remove milk from my list");
    expect(result.intent).toBe("remove");
    expect(result.items[0].productId).toBe("milk");
  });

  it("recognises negative phrasing as removal", () => {
    expect(parse("I don't need bread anymore").intent).toBe("remove");
  });

  it("clears the whole list", () => {
    expect(parse("clear my list").intent).toBe("clear");
    expect(parse("delete everything").intent).toBe("clear");
  });

  it("marks items as bought", () => {
    const result = parse("I bought the eggs");
    expect(result.intent).toBe("check");
    expect(result.items[0].productId).toBe("eggs");
  });

  it("updates quantities", () => {
    const result = parse("change milk to 3");
    expect(result.intent).toBe("update_quantity");
    expect(result.items[0]).toMatchObject({ productId: "milk", quantity: 3 });
  });

  it("reads the list back", () => {
    expect(parse("what's on my list").intent).toBe("read");
  });
});

describe("Voice search", () => {
  it("searches with a product query", () => {
    const result = parse("Find me organic apples");
    expect(result.intent).toBe("search");
    expect(result.filters?.organicOnly).toBe(true);
    expect(result.filters?.query.toLowerCase()).toContain("apple");
  });

  it("applies a price ceiling", () => {
    const result = parse("Find toothpaste under $5");
    expect(result.intent).toBe("search");
    expect(result.filters?.maxPrice).toBe(5);
    expect(result.filters?.query.toLowerCase()).toContain("toothpaste");
  });

  it("supports price ranges and brands", () => {
    const range = parse("show me juice between $2 and $4");
    expect(range.filters?.minPrice).toBe(2);
    expect(range.filters?.maxPrice).toBe(4);

    const brand = parse("find Colgate toothpaste");
    expect(brand.filters?.brand).toBe("Colgate");
  });

  it("captures a spoken size", () => {
    const result = parse("find 1 l milk");
    expect(result.filters?.size).toBeTruthy();
  });
});

describe("Hindi commands", () => {
  it("adds items", () => {
    const result = parse("दूध जोड़ो", "hi");
    expect(result.intent).toBe("add");
    expect(result.items[0].productId).toBe("milk");
    expect(result.lang).toBe("hi");
  });

  it("handles 'mujhe chahiye' phrasing with quantity", () => {
    const result = parse("मुझे दो लीटर दूध चाहिए", "hi");
    expect(result.intent).toBe("add");
    expect(result.items[0]).toMatchObject({ productId: "milk", quantity: 2, unit: "l" });
  });

  it("removes items without eating the verb tail as a number", () => {
    const result = parse("दूध हटा दो", "hi");
    expect(result.intent).toBe("remove");
    expect(result.items[0].productId).toBe("milk");
    expect(result.items[0].quantity).toBe(1);
  });

  it("splits on aur", () => {
    const result = parse("आलू और प्याज जोड़ो", "hi");
    expect(result.items.map((item) => item.productId)).toEqual(["potato", "onion"]);
  });

  it("clears the list", () => {
    expect(parse("पूरी लिस्ट हटाओ", "hi").intent).toBe("clear");
  });

  it("searches", () => {
    const result = parse("टूथपेस्ट ढूंढो", "hi");
    expect(result.intent).toBe("search");
  });

  it("accepts romanised Hindi", () => {
    const result = parse("do kilo chawal chahiye");
    expect(result.items[0]).toMatchObject({ productId: "rice", quantity: 2, unit: "kg" });
  });
});

describe("Robustness", () => {
  it("never throws on junk input", () => {
    for (const junk of ["", "   ", "!!!", "asdkjhasd", "12345"]) {
      expect(() => parse(junk)).not.toThrow();
    }
  });

  it("reports low confidence when nothing is understood", () => {
    expect(parse("asdkjhasd qwerty").confidence).toBeLessThan(0.7);
  });
});

describe("Confirmation replies", () => {
  it("recognises affirmatives in both languages", () => {
    for (const phrase of ["yes", "yeah", "sure", "ok", "add it", "हाँ", "जी हाँ", "ठीक है"]) {
      expect(matchConfirmation(phrase), phrase).toBe("yes");
    }
  });

  it("recognises negatives in both languages", () => {
    for (const phrase of ["no", "nope", "not now", "skip", "नहीं", "अभी नहीं", "रहने दो"]) {
      expect(matchConfirmation(phrase), phrase).toBe("no");
    }
  });

  it("ignores anything that is a real command", () => {
    expect(matchConfirmation("add two litres of milk")).toBeNull();
    expect(matchConfirmation("find toothpaste under $5")).toBeNull();
    expect(matchConfirmation("")).toBeNull();
  });
});
