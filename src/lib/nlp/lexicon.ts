import type { Unit } from "../types";

export type Intent =
  | "add"
  | "remove"
  | "update_quantity"
  | "check"
  | "uncheck"
  | "clear"
  | "search"
  | "read"
  | "undo"
  | "help"
  | "unknown";

/** Number words in English, Devanagari Hindi and romanised Hindi. */
export const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, fifty: 50, hundred: 100, couple: 2, "half": 0.5, quarter: 0.25,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8,
  नौ: 9, दस: 10, ग्यारह: 11, बारह: 12, पंद्रह: 15, बीस: 20, आधा: 0.5, आधी: 0.5,
  डेढ़: 1.5, ढाई: 2.5, पौन: 0.75, सवा: 1.25,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chah: 6,
  saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, pandrah: 15, bees: 20,
  adha: 0.5, aadha: 0.5, dedh: 1.5, dhai: 2.5,
};

/** Spoken unit -> canonical unit. */
export const UNIT_WORDS: Record<string, Unit> = {
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  किलो: "kg", किलोग्राम: "kg",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", ग्राम: "g",
  l: "l", ltr: "l", litre: "l", litres: "l", liter: "l", liters: "l", लीटर: "l",
  ml: "ml", millilitre: "ml", milliliter: "ml", मिली: "ml", मिलीलीटर: "ml",
  dozen: "dozen", dozens: "dozen", दर्जन: "dozen",
  pack: "pack", packs: "pack", packet: "pack", packets: "pack", pouch: "pack",
  पैक: "pack", पैकेट: "pack",
  bottle: "bottle", bottles: "bottle", बोतल: "bottle",
  can: "can", cans: "can", tin: "can", tins: "can", कैन: "can", टिन: "can",
  box: "box", boxes: "box", carton: "box", cartons: "box", बॉक्स: "box", डिब्बा: "box",
  bag: "bag", bags: "bag", sack: "bag", बैग: "bag", थैला: "bag", बोरी: "bag",
  loaf: "loaf", loaves: "loaf",
  bunch: "bunch", bunches: "bunch", गुच्छा: "bunch", गड्डी: "bunch",
  piece: "piece", pieces: "piece", pcs: "piece", pc: "piece", नग: "piece", पीस: "piece",
};

export const UNIT_LABELS: Record<Unit, { en: string; hi: string }> = {
  piece: { en: "pc", hi: "नग" },
  kg: { en: "kg", hi: "किलो" },
  g: { en: "g", hi: "ग्राम" },
  l: { en: "L", hi: "लीटर" },
  ml: { en: "ml", hi: "मिली" },
  pack: { en: "pack", hi: "पैकेट" },
  dozen: { en: "dozen", hi: "दर्जन" },
  bottle: { en: "bottle", hi: "बोतल" },
  can: { en: "can", hi: "कैन" },
  loaf: { en: "loaf", hi: "लोफ" },
  bunch: { en: "bunch", hi: "गुच्छा" },
  box: { en: "box", hi: "डिब्बा" },
  bag: { en: "bag", hi: "बैग" },
};

/**
 * Intent triggers, ordered by specificity. The parser tests them top to bottom
 * so that "clear my list" never degrades into a plain "remove".
 */
export const INTENT_PATTERNS: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: "help",
    patterns: [/\b(help|what can (you|i) (do|say)|how does this work)\b/, /(मदद|क्या कर सकते हो)/],
  },
  {
    intent: "undo",
    patterns: [/\b(undo|revert that|go back)\b/, /(वापस करो|अनडू)/],
  },
  {
    intent: "clear",
    patterns: [
      /\b(clear|empty|reset|wipe)( out| up)?( my| the)? (list|cart|everything|all)\b/,
      /\b(delete|remove) (everything|all( the)? items|the whole list)\b/,
      /\bstart (over|fresh|a new list)\b/,
      /(पूरी\s*लिस्ट\s*(हटा\s*ओ|खाली|साफ))|(सब\s*कुछ\s*(हटा\s*ओ|मिटा\s*ओ))|(लिस्ट\s*(खाली|साफ)\s*कर)/,
    ],
  },
  {
    intent: "read",
    patterns: [
      /\bwhat(s| is| are)?( on| in)? my (list|cart)\b/,
      /\b(read|show|tell me|say)( me)?( out)?( my| the)? (list|cart|items)\b/,
      /\bwhat do i (need|have to buy)\b/,
      /(लिस्ट\s*(में\s*क्या|पढ़ो|बता\s*ओ|दिखा\s*ओ))|(क्या\s*क्या\s*(लेना|चाहिए))/,
    ],
  },
  {
    intent: "search",
    patterns: [
      /\b(find|search( for)?|look for|show me|do you have|any)\b/,
      /\b(price|cost|how much (is|are|does))\b/,
      /(ढूंढ\s*ो?|खोज\s*ो?|सर्च\s*कर|कीमत|दाम|भाव|कितने\s*(का|की|के))/,
    ],
  },
  {
    intent: "uncheck",
    patterns: [/\b(uncheck|unmark|not bought|didnt (buy|get))\b/, /(वापस लिस्ट में|अनमार्क)/],
  },
  {
    intent: "check",
    patterns: [
      /\b(mark|tick|check)( off| as)?( bought| done| purchased| complete)?\b/,
      /\b(i )?(already )?(bought|got|picked up|purchased)\b/,
      /(खरीद\s*(लिया|लिये|लिए)|ले\s*(लिया|लिये|लिए)|हो\s*गया|मार्क\s*कर|खरीद\s*चुका)/,
    ],
  },
  {
    intent: "update_quantity",
    patterns: [
      /\b(change|update|set|make it)\b/,
      /\b(increase|decrease|reduce)\b/,
      /(बदल\s*ो?|कर\s*दो|कर\s*दीजिए)/,
    ],
  },
  {
    intent: "remove",
    patterns: [
      /\b(remove|delete|drop|erase)\b/,
      /\btake (it |them )?(off|out)\b/,
      /\b(dont|do not|no longer) (need|want)\b/,
      /\bcancel\b/,
      /(हटा\s*(ओ|दो|दीजिए|दीजिये|दे)|निकाल\s*(ो|दो|दीजिए)|मिटा\s*(ओ|दो)|डिलीट|नहीं\s*(चाहिए|लेना|खरीदना))/,
    ],
  },
  {
    intent: "add",
    patterns: [
      /\b(add|put|include|append)\b/,
      /\b(i )?(need|want|would like|have to (buy|get))\b/,
      /\b(buy|get|grab|pick up|order|bring|purchase)\b/,
      /(जोड़|डाल|ऐड\s*कर|चाहिए|ले(ना|ने)\s*(है|हैं)|खरीद(ना|ने)\s*(है|हैं)|लाना\s*है|ले\s*आना|लिस्ट\s*में)/,
    ],
  },
];

/** Words removed before item lookup — they never form part of a product name. */
export const FILLER_WORDS = new Set([
  "please", "kindly", "just", "also", "some", "a", "an", "the", "my", "our",
  "to", "from", "on", "in", "into", "of", "for", "me", "i", "we", "us", "it",
  "list", "shopping", "cart", "now", "then", "can", "you", "could", "would",
  "hey", "okay", "ok", "lets", "there", "that", "this", "and",
  "मुझे", "मेरी", "मेरे", "मेरा", "में", "को", "की", "का", "के", "कुछ", "थोड़ा",
  "थोड़ी", "प्लीज़", "प्लीज", "ज़रा", "जरा", "है", "हैं", "दो", "और", "से", "पर",
  "लिस्ट", "सूची", "बस", "अभी",
]);

/** Descriptors we keep as free-text notes on the list item. */
export const MODIFIER_WORDS = new Set([
  "organic", "fresh", "frozen", "low", "fat", "skimmed", "toned", "full", "cream",
  "whole", "brown", "white", "diet", "sugar-free", "sugarfree", "gluten-free",
  "glutenfree", "large", "small", "big", "extra", "premium", "imported", "local",
  "ripe", "raw", "unsalted", "salted", "roasted", "boneless",
  "ऑर्गेनिक", "ताज़ा", "ताजा", "बड़ा", "छोटा", "बिना", "देसी",
]);

/** Conjunctions that separate multiple items inside one utterance. */
export const SPLIT_PATTERN =
  /\s*(?:,|;|\balong with\b|\bas well as\b|\btogether with\b|\band\b|\balso\b|\bplus\b|\baur\b|और|तथा|\&)\s*/;

export const PRICE_UNDER = /(?:under|below|less than|cheaper than|up ?to|within|max(?:imum)?|से कम|के अंदर|तक)\s*\$?\s*(\d+(?:\.\d+)?)/;
export const PRICE_OVER = /(?:over|above|more than|at least|min(?:imum)?|से (?:ज्यादा|अधिक))\s*\$?\s*(\d+(?:\.\d+)?)/;
export const PRICE_BETWEEN = /between\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:and|to|-)\s*\$?\s*(\d+(?:\.\d+)?)/;
export const PRICE_TRAILING = /\$\s*(\d+(?:\.\d+)?)/;
