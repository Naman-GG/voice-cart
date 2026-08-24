# 🛒 Voice Cart — Voice Command Shopping Assistant

Build a shopping list by *talking* to it, in **English or Hindi**. Voice Cart understands
natural phrasing ("I need two litres of milk"), categorises items automatically, remembers
what you buy, and answers voice-driven product searches ("find toothpaste under $5").

**Live demo:** _see the deployment URL in the project description_
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Web Speech API

---

## Why it works without an API key

Speech recognition runs **on-device** through the browser's Web Speech API, and intent
parsing is a **deterministic rule-based NLP pipeline** written from scratch. There is no
LLM in the request path, which means:

- zero per-request cost and no API keys to provision,
- replies in ~1 ms instead of ~1 s,
- the parser is a pure function, so it is covered by **64 unit tests**,
- the whole thing keeps working when the network drops.

---

## Features

### 1. Voice input
- **Push-to-talk** microphone with live interim transcription, plus a **hands-free mode** (`∞`)
  that keeps the mic open across utterances.
- **Natural language understanding** — all of these mean the same thing:
  `Add milk` · `I need milk` · `I want to buy milk` · `grab some milk` · `milk`
- **Multilingual**: English (`en-US`) and Hindi (`hi-IN`). Hindi is understood in
  Devanagari (`दूध जोड़ो`) *and* in romanised Hinglish (`do kilo chawal chahiye`).
  The whole UI, the spoken replies and the suggestion copy switch language too.
- **Spoken replies** via speech synthesis, so the app is usable without looking at it.
- Keyboard shortcut: press <kbd>M</kbd> to toggle the microphone.

### 2. Smart suggestions
Four independent signals, blended and ranked, then *diversified* so no single signal
floods the rail:

| Signal | Example |
| --- | --- |
| **Repurchase history** | "Looks like you're running low on bread — last added 10 days ago." |
| **Seasonal** | "Carrots: in season right now." |
| **Substitutes** | "Prefer an alternative to milk? Try almond milk." |
| **Complements** | "Pasta sauce goes well with pasta." |

Cadence is *learned*: if you actually buy rice every 4 days, that beats the catalog's
30-day default. Items already on the list are never suggested.

### 3. Shopping list management
- Add / remove / update by voice — `Remove milk from my list`, `change milk to 3`,
  `I bought the eggs`, `clear my list`.
- **Automatic categorisation** into 12 supermarket aisles, sorted in walking order.
- **Quantities and units** — `Add 2 bottles of water`, `Buy 5 oranges`, `add 500g paneer`,
  `दो लीटर दूध`. Repeat additions merge (`2 bottles` + `3 bottles` = `5 bottles`).
- **Multi-item utterances** — `add bread and butter and 6 eggs` adds three items.
- Single-step **undo**, running **cost estimate**, and per-item **substitute swap**.
- The list is saved to `localStorage`, so it survives a refresh.

### 4. Voice-activated search
- `Find organic apples` · `Find toothpaste under $5` · `show me juice between $2 and $4` ·
  `find Colgate toothpaste` · `टूथपेस्ट ढूंढो`
- Filters extracted from speech: **price ceiling / floor / range, brand, organic, size**.
- Served by a real endpoint (`POST /api/search`) with an automatic client-side fallback
  if the request fails, so search still works offline.

### 5. UI/UX
- Minimalist, mobile-first, single-column on phones and two-column on desktop.
- **Real-time visual feedback** for every recognised command, colour-coded by outcome.
- Loading skeletons while the saved list hydrates and while a search is in flight.
- Light and dark themes, full keyboard access, ARIA live regions for screen readers.
- Graceful degradation: browsers without the Speech API get a clear message and a
  **text command bar** that runs the exact same parser.

---

## Voice command reference

| Intent | English | Hindi |
| --- | --- | --- |
| Add | "add two litres of milk" | "दो लीटर दूध जोड़ो" |
| Add (natural) | "I need apples and bread" | "मुझे सेब और ब्रेड चाहिए" |
| Remove | "remove milk from my list" | "दूध हटा दो" |
| Update quantity | "change milk to 3" | "दूध तीन कर दो" |
| Mark bought | "I bought the eggs" | "अंडे खरीद लिए" |
| Clear | "clear my list" | "पूरी लिस्ट हटाओ" |
| Read back | "what's on my list" | "लिस्ट में क्या है" |
| Search | "find toothpaste under $5" | "टूथपेस्ट ढूंढो" |
| Help | "help" | "मदद" |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm test             # 64 unit tests (Vitest)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
```

> **Browser support:** the Web Speech API needs Chrome, Edge, or Safari 14.1+.
> Firefox has no speech recognition — the app detects this and offers the text
> command bar instead. Voice input requires HTTPS (or localhost) and microphone
> permission.

---

## Architecture

```
src/
├─ app/
│  ├─ page.tsx              Orchestrates speech ⇄ parser ⇄ reducer ⇄ UI
│  ├─ layout.tsx            Metadata, fonts, theme colours
│  └─ api/search/route.ts   POST/GET catalog search endpoint
├─ components/              MicButton, ShoppingList, SuggestionRail, SearchPanel, …
├─ hooks/
│  ├─ useSpeechRecognition.ts   Web Speech API wrapper (prefixes, errors, restarts)
│  └─ useSpeechSynthesis.ts     Spoken replies with voice selection
└─ lib/
   ├─ nlp/
   │  ├─ normalize.ts       Unicode/punctuation folding, singulariser, edit distance
   │  ├─ lexicon.ts         Numbers, units, intent patterns, fillers (en + hi)
   │  ├─ match.ts           Longest-alias n-gram matcher with fuzzy fallback
   │  └─ parser.ts          transcript → { intent, items, filters, confidence }
   ├─ catalog.ts            ~150 products: aliases, prices, seasons, substitutes
   ├─ suggestions.ts        Four-signal recommender with kind diversification
   ├─ search.ts             Ranking + price/brand/organic filtering
   ├─ store.ts              Pure reducer: commands → list mutations + replies
   └─ i18n.ts               UI strings and example commands per language
```

### How a command flows

```
"मुझे दो किलो चावल और प्याज चाहिए"
   → normalize        strip punctuation, fold case, detect Devanagari → lang = hi
   → detectIntent     matches "चाहिए" → add; strips every command verb
   → split            on "और" → ["मुझे दो किलो चावल", "प्याज"]
   → per segment      quantity 2 + unit किलो → kg; fillers dropped; alias → rice / onion
   → reducer          merges into the list, records history, builds a bilingual reply
   → UI + TTS         banner, list row, spoken confirmation
```

### Design decisions worth calling out

- **The parser is pure and synchronous.** No network, no state — which is what makes
  64 tests cheap to write and the app instant to respond.
- **Intent patterns are ordered by specificity**, and every command verb is stripped
  before item lookup. That is why `दूध हटा दो` removes milk instead of adding "2 milk"
  (the Hindi verb tail `दो` also means "two").
- **Unknown words are only added when a command verb is present.** Saying `add jackfruit`
  creates a free-text item; mumbling `asdkjh` asks you to try again rather than
  polluting the list.
- **Fuzzy matching is bounded** (Levenshtein ≤ 2, length-gated) so `tomatos` → tomato and
  `shampu` → shampoo without wild mismatches.
- **Client state lives in one reducer**, so voice commands and taps take identical paths
  and undo is a single snapshot.

---

## API

```bash
curl "https://<your-deployment>/api/search?q=toothpaste&maxPrice=5"

curl -X POST https://<your-deployment>/api/search \
  -H 'Content-Type: application/json' \
  -d '{"filters":{"query":"apples","organicOnly":true},"limit":5}'
```

Response: `{ filters, results: [{ product, price, matchedBrand? }] }`

---

## Known limitations

- Prices and the product catalog are curated static data, not a live retailer feed.
- Speech recognition quality depends on the browser and the user's accent; Hindi
  recognition needs a Hindi voice pack on some platforms.
- History and the list are per-browser (`localStorage`) — there are no accounts.
- The parser covers the command grammar in the table above; free-form conversation
  ("what should I cook tonight?") is out of scope by design.

## Licence

MIT
