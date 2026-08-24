import { describe, expect, it } from "vitest";
import { matchConfirmation, parseCommand, parseUtterance } from "@/lib/nlp/parser";

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

/**
 * Whisper formats text differently from a browser recogniser: it writes
 * digits, adds sentence punctuation and capitalises. These are verbatim
 * transcripts captured from the /api/transcribe endpoint.
 */
describe("Real Whisper large-v3 transcripts", () => {
  it("parses an English multi-item add", () => {
    const result = parse("Add 2 liters of milk and 6 eggs to my list.");
    expect(result.intent).toBe("add");
    expect(result.items.map((item) => item.productId)).toEqual(["milk", "eggs"]);
    expect(result.items[0]).toMatchObject({ quantity: 2, unit: "l" });
    expect(result.items[1]).toMatchObject({ quantity: 6 });
  });

  it("parses a search with a dollar amount", () => {
    const result = parse("Find toothpaste under $5.");
    expect(result.intent).toBe("search");
    expect(result.filters?.maxPrice).toBe(5);
    expect(result.filters?.query.toLowerCase()).toContain("toothpaste");
  });

  it("parses Hindi with a trailing danda", () => {
    const result = parse("मुझे दो किलो चावल और प्याज चाहिए।", "hi");
    expect(result.intent).toBe("add");
    expect(result.items.map((item) => item.productId)).toEqual(["rice", "onion"]);
    expect(result.items[0]).toMatchObject({ quantity: 2, unit: "kg" });
  });
});

describe("Quantity and units", () => {
  it("defaults to pieces when no unit is spoken", () => {
    // "1 g toothpaste" was nonsense; an unspoken unit means "one of these".
    expect(parse("add toothpaste").items[0]).toMatchObject({ productId: "toothpaste", quantity: 1, unit: "piece" });
    expect(parse("add milk").items[0]).toMatchObject({ productId: "milk", quantity: 1, unit: "piece" });
    expect(parse("add 3 apples").items[0]).toMatchObject({ productId: "apple", quantity: 3, unit: "piece" });
  });

  it("keeps a unit whenever the shopper actually says one", () => {
    expect(parse("add 2 kg rice").items[0].unit).toBe("kg");
    expect(parse("add 2 litres of milk").items[0].unit).toBe("l");
    expect(parse("add 500g paneer").items[0].unit).toBe("g");
    expect(parse("add 2 bottles of water").items[0].unit).toBe("bottle");
    expect(parse("एक किलो चावल जोड़ो", "hi").items[0].unit).toBe("kg");
  });
});

/**
 * Verbatim Hindi transcripts captured from /api/transcribe. Whisper joins or
 * splits Hindi verbs unpredictably ("हटा दो" vs "हटादो"), conjugates them
 * several ways, and lands its errors on vowel signs rather than consonants.
 */
describe("Real Hindi Whisper transcripts", () => {
  const cases: [string, string, (string | null)[]][] = [
    ["दूध जोड़ो", "add", ["milk"]],
    ["मुझे दो किलो चावल चाहिए.", "add", ["rice"]],
    ["ब्रेड हटादो।", "remove", ["bread"]],
    ["लिस्ट में क्या है?", "read", []],
    ["दूधपेस्ट ढूंढो.", "search", ["toothpaste"]],
    ["5 सेब खरीदने हैं", "add", ["apple"]],
    ["अंदि खरीद लिये।", "check", ["eggs"]],
    ["पूरी लिस्ट हटाओ।", "clear", []],
    ["क्याज और टमाटर चाहिए.", "add", ["onion", "tomato"]],
    ["आधा किलो पनीर चाहिए.", "add", ["paneer"]],
    ["चीनी की कीमत क्या है?", "search", ["sugar"]],
  ];

  for (const [transcript, intent, products] of cases) {
    it(`handles "${transcript}"`, () => {
      const result = parse(transcript, "hi");
      expect(result.intent).toBe(intent);
      expect(result.items.map((item) => item.productId)).toEqual(products);
    });
  }

  it("reads quantities and units out of Hindi", () => {
    expect(parse("मुझे दो किलो चावल चाहिए.", "hi").items[0]).toMatchObject({ quantity: 2, unit: "kg" });
    expect(parse("आधा किलो पनीर चाहिए.", "hi").items[0]).toMatchObject({ quantity: 0.5, unit: "kg" });
    expect(parse("5 सेब खरीदने हैं", "hi").items[0]).toMatchObject({ quantity: 5, unit: "piece" });
  });

  it("accepts both the joined and spaced forms of a verb", () => {
    for (const phrase of ["ब्रेड हटा दो", "ब्रेड हटादो", "ब्रेड हटाओ", "ब्रेड निकाल दो"]) {
      expect(parse(phrase, "hi").intent, phrase).toBe("remove");
    }
  });

  it("matches Devanagari through a misheard vowel sign", () => {
    // Whisper's Indic errors land on the matras, not the consonants.
    expect(parse("अंदि जोड़ो", "hi").items[0].productId).toBe("eggs");
    expect(parse("क्याज जोड़ो", "hi").items[0].productId).toBe("onion");
  });

  it("does not resolve a Devanagari word that matches nothing", () => {
    expect(parse("क्ष्त्रज्ञ जोड़ो", "hi").items[0]?.productId ?? null).toBeNull();
  });
});

describe("Several items inside one clause", () => {
  it("handles the reported 'along with' phrasing", () => {
    const result = parse("Add 1 kg apples and 1 kg bananas along with 1 kg coriander.");
    expect(result.intent).toBe("add");
    expect(result.items.map((item) => item.productId)).toEqual(["apple", "banana", "coriander"]);
    for (const item of result.items) {
      expect(item, item.name).toMatchObject({ quantity: 1, unit: "kg" });
    }
  });

  it("splits products even without a conjunction between them", () => {
    const result = parse("add 2 kg rice 3 apples 1 loaf bread");
    expect(result.items.map((item) => item.productId)).toEqual(["rice", "apple", "bread"]);
    expect(result.items[0]).toMatchObject({ quantity: 2, unit: "kg" });
    expect(result.items[1]).toMatchObject({ quantity: 3, unit: "piece" });
    expect(result.items[2]).toMatchObject({ quantity: 1, unit: "loaf" });
  });

  it("keeps per-item modifiers with the right item", () => {
    const result = parse("add organic apples as well as 2 litres milk");
    expect(result.items.map((item) => item.productId)).toEqual(["apple", "milk"]);
    expect(result.items[0].notes).toContain("organic");
    expect(result.items[1]).toMatchObject({ quantity: 2, unit: "l" });
  });

  it("does not invent items from a single fuzzy match", () => {
    const result = parse("add tomatos");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe("tomato");
  });

  it("works the same way in Hindi", () => {
    const result = parse("एक किलो सेब और दो किलो चावल चाहिए", "hi");
    expect(result.items.map((item) => item.productId)).toEqual(["apple", "rice"]);
    expect(result.items[1]).toMatchObject({ quantity: 2, unit: "kg" });
  });
});

describe("Help", () => {
  it("recognises a bare help request", () => {
    for (const phrase of ["help", "Help.", "help me", "what can you do", "commands", "मदद", "मदद करो"]) {
      expect(parse(phrase).intent, phrase).toBe("help");
    }
  });

  it("does not hijack a command that merely contains the word help", () => {
    // "help me add milk" used to be swallowed as a help request.
    const add = parse("help me add milk");
    expect(add.intent).toBe("add");
    expect(add.items[0].productId).toBe("milk");

    const buying = parse("I need help buying bread");
    expect(buying.items.map((item) => item.productId)).toContain("bread");
    expect(buying.intent).not.toBe("help");
  });
});

describe("Compound utterances", () => {
  it("splits a remove and an add into two commands", () => {
    const parts = parseUtterance("remove paneer add tofu");
    expect(parts.map((part) => part.intent)).toEqual(["remove", "add"]);
    expect(parts[0].items.map((item) => item.productId)).toEqual(["paneer"]);
    expect(parts[1].items.map((item) => item.productId)).toEqual(["tofu"]);
  });

  it("handles the conjunction form in either order", () => {
    const first = parseUtterance("remove milk and add bread");
    expect(first.map((part) => part.intent)).toEqual(["remove", "add"]);
    expect(first[1].items[0].productId).toBe("bread");

    const second = parseUtterance("add bread and remove milk");
    expect(second.map((part) => part.intent)).toEqual(["add", "remove"]);
    expect(second[0].items[0].productId).toBe("bread");
    expect(second[1].items[0].productId).toBe("milk");
  });

  it("keeps quantities with the right clause", () => {
    const parts = parseUtterance("delete paneer, add 2 kg tofu and 6 eggs");
    expect(parts.map((part) => part.intent)).toEqual(["remove", "add"]);
    expect(parts[1].items.map((item) => item.productId)).toEqual(["tofu", "eggs"]);
    expect(parts[1].items[0]).toMatchObject({ quantity: 2, unit: "kg" });
    expect(parts[1].items[1]).toMatchObject({ quantity: 6 });
  });

  it("works in Hindi", () => {
    const parts = parseUtterance("पनीर हटाओ और टोफू जोड़ो", "hi");
    expect(parts.map((part) => part.intent)).toEqual(["remove", "add"]);
    expect(parts[0].items[0].productId).toBe("paneer");
    expect(parts[1].items[0].productId).toBe("tofu");
  });

  it("leaves a single instruction as one command", () => {
    // Repeated verbs of the same kind are already one multi-item command.
    expect(parseUtterance("add milk and bread and 6 eggs")).toHaveLength(1);
    expect(parseUtterance("add milk and add bread")).toHaveLength(1);
    expect(parseUtterance("find toothpaste under $5")).toHaveLength(1);
    expect(parseUtterance("remove milk")).toHaveLength(1);
  });
});
