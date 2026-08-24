# Approach

I treated this as a language problem with a UI attached, so most work went into the parser.

Speech capture uses the browser's Web Speech API — on-device, free, available in Chrome,
Edge and Safari, including `hi-IN` for Hindi. Rather than send transcripts to an LLM,
I wrote a deterministic NLP pipeline: normalise text, detect intent from ordered regex
patterns, strip every command verb, split multi-item utterances, then extract quantity,
unit, brand and modifiers before resolving the remainder against a 150-product catalog
via longest-alias n-gram matching with a bounded fuzzy fallback. The payoff is a pure
function — sub-millisecond, offline-capable, zero cost, and covered by 64 unit tests,
including Hindi cases where the verb tail "दो" collides with the number two.

Suggestions blend four signals — learned repurchase cadence, seasonality, substitutes
and complements — then diversify so one signal cannot flood the rail. Search extracts
price, brand, organic and size filters from speech and runs against a Next.js route
handler, falling back to the client catalog if the network fails.

State lives in one reducer, so voice and taps share a path and undo is a snapshot.
Everything degrades to a text input when speech is unavailable.
