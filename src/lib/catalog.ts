import type { CategoryId, Lang, Product, Unit } from "./types";
import { normalize, singularize } from "./nlp/normalize";

export interface CategoryMeta {
  id: CategoryId;
  label: Record<Lang, string>;
  emoji: string;
  /** Aisle order, so the list reads like a walk through the store. */
  order: number;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  produce: { id: "produce", label: { en: "Produce", hi: "फल और सब्ज़ी" }, emoji: "🥦", order: 1 },
  dairy: { id: "dairy", label: { en: "Dairy & Eggs", hi: "डेयरी और अंडे" }, emoji: "🥛", order: 2 },
  bakery: { id: "bakery", label: { en: "Bakery", hi: "बेकरी" }, emoji: "🍞", order: 3 },
  meat: { id: "meat", label: { en: "Meat & Seafood", hi: "मांस और मछली" }, emoji: "🍗", order: 4 },
  pantry: { id: "pantry", label: { en: "Pantry", hi: "रसोई का सामान" }, emoji: "🫙", order: 5 },
  spices: { id: "spices", label: { en: "Spices", hi: "मसाले" }, emoji: "🌶️", order: 6 },
  frozen: { id: "frozen", label: { en: "Frozen", hi: "फ्रोज़न" }, emoji: "🧊", order: 7 },
  snacks: { id: "snacks", label: { en: "Snacks", hi: "स्नैक्स" }, emoji: "🍪", order: 8 },
  beverages: { id: "beverages", label: { en: "Beverages", hi: "पेय पदार्थ" }, emoji: "🧃", order: 9 },
  household: { id: "household", label: { en: "Household", hi: "घरेलू सामान" }, emoji: "🧻", order: 10 },
  personal: { id: "personal", label: { en: "Personal Care", hi: "व्यक्तिगत देखभाल" }, emoji: "🧴", order: 11 },
  other: { id: "other", label: { en: "Other", hi: "अन्य" }, emoji: "🛒", order: 12 },
};

const BRANDS_BY_CATEGORY: Partial<Record<CategoryId, string[]>> = {
  produce: ["Fresh Farms", "Organic Valley", "Local Harvest"],
  dairy: ["Amul", "Mother Dairy", "Horizon Organic"],
  bakery: ["Britannia", "Harvest Gold", "La Brea"],
  meat: ["Licious", "Zorabian", "Blue Ribbon"],
  pantry: ["Tata Sampann", "Fortune", "Barilla"],
  spices: ["Everest", "MDH", "Simply Organic"],
  frozen: ["McCain", "Safal", "Birds Eye"],
  snacks: ["Lay's", "Britannia", "Haldiram's"],
  beverages: ["Tropicana", "Red Label", "Nescafé"],
  household: ["Vim", "Surf Excel", "Scotch-Brite"],
  personal: ["Colgate", "Dove", "Himalaya"],
};

const SIZES_BY_UNIT: Record<Unit, string[]> = {
  piece: ["small", "medium", "large"],
  kg: ["250 g", "500 g", "1 kg", "5 kg"],
  g: ["100 g", "200 g", "500 g"],
  l: ["500 ml", "1 L", "2 L"],
  ml: ["100 ml", "200 ml", "500 ml"],
  pack: ["small pack", "family pack", "value pack"],
  dozen: ["6 pcs", "12 pcs", "30 pcs"],
  bottle: ["330 ml", "750 ml", "1 L"],
  can: ["200 ml", "330 ml", "500 ml"],
  loaf: ["400 g", "700 g"],
  bunch: ["1 bunch", "2 bunches"],
  box: ["small box", "large box"],
  bag: ["1 kg bag", "5 kg bag"],
};

type Extra = Partial<Pick<Product, "brands" | "sizes" | "organic" | "seasonMonths" | "substitutes" | "goesWith" | "repurchaseDays">>;

function p(
  id: string,
  en: string,
  hi: string,
  aliases: string[],
  category: CategoryId,
  unit: Unit,
  price: number,
  extra: Extra = {},
): Product {
  return {
    id,
    name: { en, hi },
    aliases: Array.from(new Set([en, hi, ...aliases])),
    category,
    unit,
    price,
    brands: extra.brands ?? BRANDS_BY_CATEGORY[category] ?? [],
    sizes: extra.sizes ?? SIZES_BY_UNIT[unit],
    organic: extra.organic ?? (category === "produce" || category === "dairy"),
    seasonMonths: extra.seasonMonths,
    substitutes: extra.substitutes,
    goesWith: extra.goesWith,
    repurchaseDays: extra.repurchaseDays,
  };
}

const WINTER = [11, 12, 1, 2];
const SUMMER = [4, 5, 6];
const MONSOON = [7, 8, 9];

/**
 * A hand-curated grocery catalog spanning Indian and Western staples.
 * Prices are indicative USD values used for voice price filtering.
 */
export const CATALOG: Product[] = [
  // ---------- Produce ----------
  p("apple", "apples", "सेब", ["seb", "apple"], "produce", "kg", 3.2, { seasonMonths: [9, 10, 11, 12], substitutes: ["pear", "guava"], repurchaseDays: 7 }),
  p("banana", "bananas", "केला", ["kela", "banana"], "produce", "dozen", 1.8, { substitutes: ["apple"], goesWith: ["milk", "oats"], repurchaseDays: 5 }),
  p("orange", "oranges", "संतरा", ["santra", "narangi", "orange"], "produce", "kg", 2.6, { seasonMonths: WINTER, substitutes: ["mosambi", "orange-juice"], repurchaseDays: 8 }),
  p("mosambi", "sweet lime", "मौसंबी", ["mosambi", "musambi", "sweet lime"], "produce", "kg", 2.2, { seasonMonths: WINTER }),
  p("mango", "mangoes", "आम", ["aam", "mango"], "produce", "kg", 4.5, { seasonMonths: SUMMER, substitutes: ["papaya"] }),
  p("grapes", "grapes", "अंगूर", ["angoor", "angur", "grape"], "produce", "kg", 3.9, { seasonMonths: [2, 3, 4, 5] }),
  p("watermelon", "watermelon", "तरबूज", ["tarbooj", "tarbuj"], "produce", "piece", 4.0, { seasonMonths: SUMMER }),
  p("strawberry", "strawberries", "स्ट्रॉबेरी", ["strawberry"], "produce", "box", 4.8, { seasonMonths: WINTER, substitutes: ["blueberry"] }),
  p("blueberry", "blueberries", "ब्लूबेरी", ["blueberry"], "produce", "box", 5.5, { seasonMonths: [5, 6, 7] }),
  p("pomegranate", "pomegranate", "अनार", ["anar", "anaar"], "produce", "kg", 5.2, { seasonMonths: MONSOON }),
  p("papaya", "papaya", "पपीता", ["papita", "papeeta"], "produce", "piece", 2.4, {}),
  p("guava", "guava", "अमरूद", ["amrud", "amrood"], "produce", "kg", 2.1, { seasonMonths: WINTER }),
  p("pineapple", "pineapple", "अनानास", ["ananas", "anannas"], "produce", "piece", 3.3, {}),
  p("pear", "pears", "नाशपाती", ["nashpati", "pear"], "produce", "kg", 3.4, { seasonMonths: [8, 9, 10] }),
  p("avocado", "avocado", "एवोकाडो", ["avocado"], "produce", "piece", 2.0, { substitutes: ["butter"] }),
  p("tomato", "tomatoes", "टमाटर", ["tamatar", "tomato"], "produce", "kg", 1.9, { goesWith: ["onion"], repurchaseDays: 5 }),
  p("potato", "potatoes", "आलू", ["aloo", "alu", "potato"], "produce", "kg", 1.3, { substitutes: ["sweet-potato"], repurchaseDays: 10 }),
  p("onion", "onions", "प्याज", ["pyaz", "pyaaz", "onion"], "produce", "kg", 1.5, { goesWith: ["tomato", "garlic"], repurchaseDays: 10 }),
  p("garlic", "garlic", "लहसुन", ["lehsun", "lahsun"], "produce", "g", 1.2, { goesWith: ["ginger"] }),
  p("ginger", "ginger", "अदरक", ["adrak"], "produce", "g", 1.1, { goesWith: ["garlic", "tea"] }),
  p("spinach", "spinach", "पालक", ["palak", "spinach"], "produce", "bunch", 1.4, { seasonMonths: WINTER, substitutes: ["methi", "lettuce"] }),
  p("methi", "fenugreek leaves", "मेथी", ["methi", "fenugreek leaves"], "produce", "bunch", 1.2, { seasonMonths: WINTER }),
  p("coriander", "coriander leaves", "धनिया", ["dhania", "cilantro", "coriander"], "produce", "bunch", 0.6, { substitutes: ["mint"] }),
  p("mint", "mint", "पुदीना", ["pudina", "mint"], "produce", "bunch", 0.6, {}),
  p("carrot", "carrots", "गाजर", ["gajar", "carrot"], "produce", "kg", 1.6, { seasonMonths: WINTER }),
  p("cauliflower", "cauliflower", "फूलगोभी", ["gobhi", "gobi", "phool gobhi"], "produce", "piece", 1.7, { seasonMonths: WINTER, substitutes: ["cabbage", "broccoli"] }),
  p("cabbage", "cabbage", "पत्ता गोभी", ["patta gobhi", "band gobhi", "cabbage"], "produce", "piece", 1.2, {}),
  p("broccoli", "broccoli", "ब्रोकली", ["broccoli"], "produce", "piece", 2.5, { substitutes: ["cauliflower"] }),
  p("cucumber", "cucumber", "खीरा", ["kheera", "khira", "cucumber"], "produce", "kg", 1.4, { seasonMonths: SUMMER }),
  p("capsicum", "bell pepper", "शिमला मिर्च", ["shimla mirch", "capsicum", "bell pepper"], "produce", "kg", 2.7, {}),
  p("chilli", "green chilli", "हरी मिर्च", ["hari mirch", "green chilli", "chili"], "produce", "g", 0.8, {}),
  p("lemon", "lemons", "नींबू", ["nimbu", "neembu", "lime", "lemon"], "produce", "kg", 2.0, { seasonMonths: SUMMER }),
  p("peas", "green peas", "मटर", ["matar", "peas"], "produce", "kg", 2.3, { seasonMonths: WINTER, substitutes: ["frozen-peas"] }),
  p("okra", "okra", "भिंडी", ["bhindi", "ladies finger", "okra"], "produce", "kg", 2.2, { seasonMonths: SUMMER }),
  p("brinjal", "eggplant", "बैंगन", ["baingan", "brinjal", "eggplant", "aubergine"], "produce", "kg", 1.8, {}),
  p("pumpkin", "pumpkin", "कद्दू", ["kaddu", "pumpkin"], "produce", "kg", 1.5, { seasonMonths: [9, 10, 11] }),
  p("corn", "sweet corn", "मक्का", ["makka", "bhutta", "corn"], "produce", "piece", 1.0, { seasonMonths: MONSOON }),
  p("mushroom", "mushrooms", "मशरूम", ["mushroom"], "produce", "box", 2.9, { substitutes: ["paneer"] }),
  p("lettuce", "lettuce", "सलाद पत्ता", ["salad patta", "lettuce"], "produce", "piece", 2.0, { substitutes: ["spinach"] }),
  p("sweet-potato", "sweet potato", "शकरकंद", ["shakarkandi", "sweet potato"], "produce", "kg", 2.1, { seasonMonths: WINTER }),
  p("beetroot", "beetroot", "चुकंदर", ["chukandar", "beet", "beetroot"], "produce", "kg", 1.9, {}),

  // ---------- Dairy & Eggs ----------
  p("milk", "milk", "दूध", ["doodh", "dudh", "milk"], "dairy", "l", 1.6, { substitutes: ["almond-milk", "soy-milk", "oat-milk"], goesWith: ["cereal", "tea"], repurchaseDays: 3 }),
  p("almond-milk", "almond milk", "बादाम दूध", ["badam milk", "almond milk"], "dairy", "l", 3.4, { substitutes: ["soy-milk", "oat-milk", "milk"], repurchaseDays: 7 }),
  p("soy-milk", "soy milk", "सोया दूध", ["soya milk", "soy milk"], "dairy", "l", 3.0, { substitutes: ["almond-milk", "milk"] }),
  p("oat-milk", "oat milk", "ओट मिल्क", ["oat milk"], "dairy", "l", 3.6, { substitutes: ["almond-milk", "milk"] }),
  p("curd", "yogurt", "दही", ["dahi", "curd", "yoghurt", "yogurt"], "dairy", "kg", 2.2, { substitutes: ["greek-yogurt"], repurchaseDays: 4 }),
  p("greek-yogurt", "greek yogurt", "ग्रीक योगर्ट", ["greek yogurt", "greek yoghurt"], "dairy", "box", 3.5, { substitutes: ["curd"] }),
  p("butter", "butter", "मक्खन", ["makhan", "butter"], "dairy", "g", 3.1, { substitutes: ["ghee", "olive-oil"], goesWith: ["bread"], repurchaseDays: 14 }),
  p("ghee", "ghee", "घी", ["ghee", "clarified butter"], "dairy", "l", 8.5, { substitutes: ["butter"], repurchaseDays: 45 }),
  p("cheese", "cheese", "चीज़", ["cheese", "chiz"], "dairy", "g", 4.2, { substitutes: ["paneer"], goesWith: ["bread"] }),
  p("paneer", "paneer", "पनीर", ["paneer", "cottage cheese"], "dairy", "g", 3.8, { substitutes: ["tofu", "cheese"], repurchaseDays: 10 }),
  p("cream", "fresh cream", "क्रीम", ["cream", "malai"], "dairy", "ml", 2.4, {}),
  p("buttermilk", "buttermilk", "छाछ", ["chaas", "chhach", "buttermilk"], "dairy", "l", 1.5, { seasonMonths: SUMMER }),
  p("eggs", "eggs", "अंडे", ["anda", "ande", "egg"], "dairy", "dozen", 3.2, { substitutes: ["tofu"], goesWith: ["bread"], repurchaseDays: 7 }),

  // ---------- Bakery ----------
  p("bread", "bread", "ब्रेड", ["bread", "double roti", "pav roti"], "bakery", "loaf", 2.3, { substitutes: ["brown-bread", "tortilla"], goesWith: ["butter", "eggs", "jam"], repurchaseDays: 4 }),
  p("brown-bread", "whole wheat bread", "ब्राउन ब्रेड", ["brown bread", "whole wheat bread", "atta bread"], "bakery", "loaf", 2.8, { substitutes: ["bread"], repurchaseDays: 4 }),
  p("bun", "burger buns", "बन", ["bun", "burger bun", "pav"], "bakery", "pack", 2.0, {}),
  p("croissant", "croissant", "क्रोसां", ["croissant"], "bakery", "piece", 1.9, {}),
  p("bagel", "bagels", "बेगल", ["bagel"], "bakery", "pack", 3.2, {}),
  p("cake", "cake", "केक", ["cake"], "bakery", "piece", 8.5, {}),
  p("tortilla", "tortilla", "टॉर्टिला", ["tortilla", "wrap"], "bakery", "pack", 2.9, { substitutes: ["bread"] }),

  // ---------- Meat & Seafood ----------
  p("chicken", "chicken", "चिकन", ["chicken", "murga", "murgi"], "meat", "kg", 6.5, { substitutes: ["tofu", "paneer"], repurchaseDays: 7 }),
  p("mutton", "mutton", "मटन", ["mutton", "goat meat", "bakra"], "meat", "kg", 11.0, { substitutes: ["chicken"] }),
  p("fish", "fish", "मछली", ["machli", "machhli", "fish"], "meat", "kg", 8.0, { substitutes: ["prawns", "chicken"] }),
  p("prawns", "prawns", "झींगा", ["jhinga", "prawn", "shrimp"], "meat", "kg", 12.0, { substitutes: ["fish"] }),
  p("bacon", "bacon", "बेकन", ["bacon"], "meat", "pack", 5.5, { substitutes: ["sausage"] }),
  p("sausage", "sausages", "सॉसेज", ["sausage"], "meat", "pack", 4.6, { substitutes: ["bacon"] }),
  p("tofu", "tofu", "टोफू", ["tofu"], "meat", "g", 3.0, { substitutes: ["paneer"] }),

  // ---------- Pantry ----------
  p("rice", "rice", "चावल", ["chawal", "chaval", "rice"], "pantry", "kg", 2.4, { substitutes: ["basmati-rice", "quinoa"], repurchaseDays: 30 }),
  p("basmati-rice", "basmati rice", "बासमती चावल", ["basmati", "basmati rice"], "pantry", "kg", 4.1, { substitutes: ["rice"] }),
  p("quinoa", "quinoa", "क्विनोआ", ["quinoa"], "pantry", "kg", 7.5, { substitutes: ["rice"] }),
  p("atta", "wheat flour", "आटा", ["atta", "aata", "wheat flour", "flour"], "pantry", "kg", 2.0, { substitutes: ["maida"], repurchaseDays: 25 }),
  p("maida", "all purpose flour", "मैदा", ["maida", "all purpose flour", "refined flour"], "pantry", "kg", 1.8, { substitutes: ["atta"] }),
  p("besan", "gram flour", "बेसन", ["besan", "gram flour"], "pantry", "kg", 2.3, {}),
  p("suji", "semolina", "सूजी", ["suji", "sooji", "semolina", "rava"], "pantry", "kg", 1.9, {}),
  p("poha", "flattened rice", "पोहा", ["poha", "flattened rice", "chivda"], "pantry", "kg", 1.7, {}),
  p("sugar", "sugar", "चीनी", ["cheeni", "chini", "sugar", "shakkar"], "pantry", "kg", 1.5, { substitutes: ["jaggery", "honey"], repurchaseDays: 30 }),
  p("jaggery", "jaggery", "गुड़", ["gud", "gur", "jaggery"], "pantry", "kg", 2.2, { substitutes: ["sugar"], seasonMonths: WINTER }),
  p("salt", "salt", "नमक", ["namak", "salt"], "pantry", "kg", 0.9, { repurchaseDays: 60 }),
  p("cooking-oil", "cooking oil", "तेल", ["tel", "cooking oil", "refined oil", "sunflower oil"], "pantry", "l", 3.6, { substitutes: ["olive-oil", "mustard-oil"], repurchaseDays: 30 }),
  p("olive-oil", "olive oil", "जैतून का तेल", ["olive oil", "jaitun ka tel"], "pantry", "l", 9.9, { substitutes: ["cooking-oil"] }),
  p("mustard-oil", "mustard oil", "सरसों का तेल", ["sarson ka tel", "mustard oil"], "pantry", "l", 4.4, { substitutes: ["cooking-oil"] }),
  p("toor-dal", "pigeon pea lentils", "तूर दाल", ["toor dal", "arhar dal", "tur dal"], "pantry", "kg", 3.2, { substitutes: ["moong-dal", "masoor-dal"], repurchaseDays: 30 }),
  p("moong-dal", "split green gram", "मूंग दाल", ["moong dal", "mung dal"], "pantry", "kg", 3.0, { substitutes: ["toor-dal"] }),
  p("masoor-dal", "red lentils", "मसूर दाल", ["masoor dal", "red lentil", "lentils", "dal", "daal"], "pantry", "kg", 2.8, { substitutes: ["toor-dal"] }),
  p("chana", "chickpeas", "चना", ["chana", "chole", "chickpea", "garbanzo"], "pantry", "kg", 2.6, { substitutes: ["rajma"] }),
  p("rajma", "kidney beans", "राजमा", ["rajma", "kidney beans"], "pantry", "kg", 3.1, { substitutes: ["chana"] }),
  p("pasta", "pasta", "पास्ता", ["pasta", "penne", "macaroni", "spaghetti"], "pantry", "pack", 2.5, { goesWith: ["pasta-sauce", "cheese"], substitutes: ["noodles"] }),
  p("pasta-sauce", "pasta sauce", "पास्ता सॉस", ["pasta sauce", "marinara"], "pantry", "bottle", 3.7, { goesWith: ["pasta"] }),
  p("noodles", "noodles", "नूडल्स", ["noodles", "maggi", "ramen"], "pantry", "pack", 1.6, { substitutes: ["pasta"] }),
  p("oats", "oats", "ओट्स", ["oats", "oatmeal"], "pantry", "kg", 3.9, { goesWith: ["milk", "banana"], substitutes: ["cereal"], repurchaseDays: 21 }),
  p("cereal", "breakfast cereal", "सीरियल", ["cereal", "cornflakes", "corn flakes", "muesli"], "pantry", "box", 4.5, { goesWith: ["milk"], substitutes: ["oats"], repurchaseDays: 21 }),
  p("honey", "honey", "शहद", ["shahad", "honey"], "pantry", "bottle", 5.2, { substitutes: ["sugar", "jaggery"] }),
  p("peanut-butter", "peanut butter", "पीनट बटर", ["peanut butter", "moongfali butter"], "pantry", "bottle", 4.8, { goesWith: ["bread"], substitutes: ["jam"] }),
  p("jam", "jam", "जैम", ["jam", "mixed fruit jam"], "pantry", "bottle", 3.3, { goesWith: ["bread"], substitutes: ["honey", "peanut-butter"] }),
  p("ketchup", "tomato ketchup", "केचप", ["ketchup", "tomato sauce", "catsup"], "pantry", "bottle", 2.9, {}),
  p("mayonnaise", "mayonnaise", "मेयोनीज़", ["mayonnaise", "mayo"], "pantry", "bottle", 3.4, {}),
  p("vinegar", "vinegar", "सिरका", ["sirka", "vinegar"], "pantry", "bottle", 2.1, {}),
  p("soy-sauce", "soy sauce", "सोया सॉस", ["soy sauce", "soya sauce"], "pantry", "bottle", 2.7, {}),
  p("baking-powder", "baking powder", "बेकिंग पाउडर", ["baking powder", "baking soda"], "pantry", "box", 1.8, {}),
  p("almonds", "almonds", "बादाम", ["badam", "almond"], "pantry", "kg", 12.0, { substitutes: ["cashews", "walnuts"], seasonMonths: WINTER }),
  p("cashews", "cashews", "काजू", ["kaju", "cashew"], "pantry", "kg", 13.5, { substitutes: ["almonds"] }),
  p("raisins", "raisins", "किशमिश", ["kishmish", "raisin"], "pantry", "kg", 6.5, {}),
  p("walnuts", "walnuts", "अखरोट", ["akhrot", "walnut"], "pantry", "kg", 14.0, { substitutes: ["almonds"], seasonMonths: WINTER }),
  p("coconut", "coconut", "नारियल", ["nariyal", "coconut"], "pantry", "piece", 1.6, {}),

  // ---------- Spices ----------
  p("turmeric", "turmeric powder", "हल्दी", ["haldi", "turmeric"], "spices", "g", 1.5, { repurchaseDays: 60 }),
  p("chilli-powder", "red chilli powder", "लाल मिर्च पाउडर", ["lal mirch", "chilli powder", "chili powder", "mirchi powder"], "spices", "g", 1.8, {}),
  p("cumin", "cumin seeds", "जीरा", ["jeera", "cumin"], "spices", "g", 2.2, {}),
  p("coriander-powder", "coriander powder", "धनिया पाउडर", ["dhania powder", "coriander powder"], "spices", "g", 1.6, {}),
  p("garam-masala", "garam masala", "गरम मसाला", ["garam masala"], "spices", "g", 2.5, {}),
  p("black-pepper", "black pepper", "काली मिर्च", ["kali mirch", "black pepper", "peppercorn"], "spices", "g", 3.0, {}),
  p("mustard-seeds", "mustard seeds", "सरसों", ["sarson", "rai", "mustard seeds"], "spices", "g", 1.4, {}),
  p("cardamom", "cardamom", "इलायची", ["elaichi", "ilaichi", "cardamom"], "spices", "g", 6.0, { goesWith: ["tea"] }),
  p("cinnamon", "cinnamon", "दालचीनी", ["dalchini", "cinnamon"], "spices", "g", 3.2, {}),
  p("cloves", "cloves", "लौंग", ["laung", "clove"], "spices", "g", 4.0, {}),
  p("bay-leaf", "bay leaf", "तेज पत्ता", ["tej patta", "bay leaf"], "spices", "g", 1.2, {}),
  p("hing", "asafoetida", "हींग", ["hing", "asafoetida"], "spices", "g", 3.5, {}),

  // ---------- Frozen ----------
  p("frozen-peas", "frozen peas", "फ्रोज़न मटर", ["frozen peas", "frozen matar"], "frozen", "pack", 2.2, { substitutes: ["peas"] }),
  p("frozen-pizza", "frozen pizza", "फ्रोज़न पिज़्ज़ा", ["frozen pizza", "pizza"], "frozen", "piece", 5.9, {}),
  p("ice-cream", "ice cream", "आइसक्रीम", ["ice cream", "icecream", "kulfi"], "frozen", "box", 4.9, { seasonMonths: SUMMER }),
  p("french-fries", "french fries", "फ्रेंच फ्राइज़", ["french fries", "fries", "finger chips"], "frozen", "pack", 3.4, {}),
  p("frozen-paratha", "frozen paratha", "फ्रोज़न पराठा", ["frozen paratha", "paratha"], "frozen", "pack", 3.1, {}),

  // ---------- Snacks ----------
  p("chips", "potato chips", "चिप्स", ["chips", "wafers", "crisps"], "snacks", "pack", 1.9, { substitutes: ["popcorn", "namkeen"] }),
  p("biscuits", "biscuits", "बिस्कुट", ["biscuit", "cookies", "cookie"], "snacks", "pack", 1.6, { goesWith: ["tea"], repurchaseDays: 10 }),
  p("namkeen", "namkeen", "नमकीन", ["namkeen", "mixture", "sev"], "snacks", "pack", 2.1, { substitutes: ["chips"] }),
  p("chocolate", "chocolate", "चॉकलेट", ["chocolate", "choclate"], "snacks", "piece", 2.4, { substitutes: ["candy"] }),
  p("popcorn", "popcorn", "पॉपकॉर्न", ["popcorn"], "snacks", "pack", 2.0, { substitutes: ["chips"] }),
  p("candy", "candy", "टॉफ़ी", ["candy", "toffee", "sweets"], "snacks", "pack", 1.5, {}),

  // ---------- Beverages ----------
  p("water", "bottled water", "पानी", ["pani", "water", "mineral water", "bottled water"], "beverages", "bottle", 0.9, { repurchaseDays: 3 }),
  p("tea", "tea", "चाय", ["chai", "tea", "tea leaves", "tea bags"], "beverages", "g", 4.2, { goesWith: ["milk", "sugar", "biscuits"], substitutes: ["green-tea", "coffee"], repurchaseDays: 25 }),
  p("green-tea", "green tea", "ग्रीन टी", ["green tea"], "beverages", "box", 5.1, { substitutes: ["tea"] }),
  p("coffee", "coffee", "कॉफ़ी", ["coffee", "kofi"], "beverages", "g", 6.8, { substitutes: ["tea"], repurchaseDays: 25 }),
  p("orange-juice", "orange juice", "संतरे का जूस", ["orange juice", "santra juice"], "beverages", "l", 3.5, { substitutes: ["apple-juice", "orange"] }),
  p("apple-juice", "apple juice", "सेब का जूस", ["apple juice"], "beverages", "l", 3.4, { substitutes: ["orange-juice"] }),
  p("cola", "soft drink", "कोल्ड ड्रिंक", ["cola", "coke", "soft drink", "cold drink", "soda", "pepsi"], "beverages", "bottle", 1.8, { substitutes: ["coconut-water"] }),
  p("coconut-water", "coconut water", "नारियल पानी", ["coconut water", "nariyal pani"], "beverages", "bottle", 2.3, { seasonMonths: SUMMER }),
  p("lassi", "lassi", "लस्सी", ["lassi"], "beverages", "bottle", 1.9, { seasonMonths: SUMMER }),
  p("energy-drink", "energy drink", "एनर्जी ड्रिंक", ["energy drink", "red bull"], "beverages", "can", 2.6, {}),

  // ---------- Household ----------
  p("dish-soap", "dish soap", "बर्तन धोने का साबुन", ["dish soap", "dishwashing liquid", "vim", "bartan sabun"], "household", "bottle", 3.2, { repurchaseDays: 30 }),
  p("detergent", "laundry detergent", "डिटर्जेंट", ["detergent", "washing powder", "surf", "laundry soap"], "household", "kg", 6.4, { repurchaseDays: 35 }),
  p("floor-cleaner", "floor cleaner", "फ़र्श क्लीनर", ["floor cleaner", "phenyl", "lizol"], "household", "bottle", 4.1, {}),
  p("garbage-bags", "garbage bags", "कचरा बैग", ["garbage bags", "trash bags", "dustbin bags"], "household", "pack", 2.8, { repurchaseDays: 30 }),
  p("paper-towels", "paper towels", "पेपर टॉवल", ["paper towels", "kitchen towel", "kitchen roll"], "household", "pack", 3.6, { repurchaseDays: 21 }),
  p("toilet-paper", "toilet paper", "टॉयलेट पेपर", ["toilet paper", "toilet roll", "tissue roll"], "household", "pack", 5.4, { repurchaseDays: 21 }),
  p("aluminium-foil", "aluminium foil", "एल्युमिनियम फॉयल", ["aluminium foil", "aluminum foil", "silver foil"], "household", "box", 2.9, {}),
  p("sponge", "scrub sponge", "स्पंज", ["sponge", "scrubber", "scotch brite"], "household", "pack", 1.7, {}),
  p("matchbox", "matchbox", "माचिस", ["machis", "matchbox", "matches"], "household", "box", 0.5, {}),
  p("candles", "candles", "मोमबत्ती", ["mombatti", "candle"], "household", "pack", 2.2, {}),

  // ---------- Personal Care ----------
  p("toothpaste", "toothpaste", "टूथपेस्ट", ["toothpaste", "tooth paste", "manjan"], "personal", "g", 3.5, { goesWith: ["toothbrush"], repurchaseDays: 40 }),
  p("toothbrush", "toothbrush", "टूथब्रश", ["toothbrush", "tooth brush", "brush"], "personal", "piece", 2.0, { repurchaseDays: 90 }),
  p("shampoo", "shampoo", "शैम्पू", ["shampoo", "shampu"], "personal", "bottle", 5.9, { goesWith: ["conditioner"], repurchaseDays: 45 }),
  p("conditioner", "conditioner", "कंडीशनर", ["conditioner"], "personal", "bottle", 6.2, {}),
  p("soap", "bath soap", "साबुन", ["sabun", "soap", "bathing soap"], "personal", "pack", 3.0, { substitutes: ["body-wash"], repurchaseDays: 30 }),
  p("body-wash", "body wash", "बॉडी वॉश", ["body wash", "shower gel"], "personal", "bottle", 6.5, { substitutes: ["soap"] }),
  p("face-wash", "face wash", "फेस वॉश", ["face wash", "facewash"], "personal", "bottle", 5.5, {}),
  p("deodorant", "deodorant", "डियोड्रेंट", ["deodorant", "deo", "perfume"], "personal", "bottle", 4.7, {}),
  p("razor", "razor", "रेज़र", ["razor", "shaving razor"], "personal", "pack", 4.2, { goesWith: ["shaving-cream"] }),
  p("shaving-cream", "shaving cream", "शेविंग क्रीम", ["shaving cream", "shaving gel"], "personal", "g", 3.8, {}),
  p("hand-sanitizer", "hand sanitizer", "सैनिटाइज़र", ["sanitizer", "hand sanitizer"], "personal", "bottle", 2.9, {}),
  p("moisturizer", "moisturizer", "मॉइस्चराइज़र", ["moisturizer", "lotion", "cold cream"], "personal", "bottle", 6.9, { seasonMonths: WINTER }),
  p("sunscreen", "sunscreen", "सनस्क्रीन", ["sunscreen", "sunblock", "spf"], "personal", "bottle", 8.4, { seasonMonths: SUMMER }),
  p("tissues", "facial tissues", "टिशू", ["tissues", "tissue paper", "napkins"], "personal", "box", 2.4, {}),
  p("sanitary-pads", "sanitary pads", "सैनिटरी पैड", ["sanitary pads", "pads", "whisper", "stayfree"], "personal", "pack", 4.3, { repurchaseDays: 30 }),
  p("diapers", "diapers", "डायपर", ["diapers", "diaper", "nappy", "pampers"], "personal", "pack", 12.5, { repurchaseDays: 14 }),
  p("baby-wipes", "baby wipes", "बेबी वाइप्स", ["baby wipes", "wet wipes", "wipes"], "personal", "pack", 3.9, {}),
];

export const PRODUCTS_BY_ID: ReadonlyMap<string, Product> = new Map(CATALOG.map((item) => [item.id, item]));

export function getProduct(id: string | null | undefined): Product | undefined {
  return id ? PRODUCTS_BY_ID.get(id) : undefined;
}

/** Exact-phrase index: normalised alias (with plurals folded) -> product id. */
export const ALIAS_INDEX: ReadonlyMap<string, string> = (() => {
  const index = new Map<string, string>();
  for (const product of CATALOG) {
    for (const alias of product.aliases) {
      const key = normalize(alias);
      if (!key) continue;
      if (!index.has(key)) index.set(key, product.id);
      const folded = key.split(" ").map(singularize).join(" ");
      if (!index.has(folded)) index.set(folded, product.id);
    }
  }
  return index;
})();

/** Longest alias phrase in the catalog, bounds the n-gram scan in the matcher. */
export const MAX_ALIAS_WORDS = Array.from(ALIAS_INDEX.keys()).reduce(
  (max, key) => Math.max(max, key.split(" ").length),
  1,
);

export const ALL_BRANDS: string[] = Array.from(
  new Set(CATALOG.flatMap((product) => product.brands)),
).sort();
