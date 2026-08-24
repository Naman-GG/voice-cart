# Approach

I treated this as a language problem with a UI attached, so most work went into the parser.

Recognition and understanding are deliberately split. Speech goes to Whisper large-v3 on
Groq, prompted with the app's own grocery vocabulary, which handles accents and Hinglish
code-switching far better than any browser recogniser. Understanding stays local and
deterministic: normalise text, detect intent from ordered regex patterns, strip every
command verb, split multi-item utterances, then extract quantity, unit, brand and
modifiers before resolving the remainder against a 150-product catalog via longest-alias
n-gram matching with a bounded fuzzy fallback. That half is a pure function — instant,
free, and covered by 72 tests, including Hindi cases where the verb tail "दो" collides
with the number two.

Hands-free is genuine: an analyser node tracks input level against an adaptive noise
floor, so speech opens a clip and a second of silence closes it. The mic mutes while the
assistant talks, so it never transcribes itself. After ten seconds of silence it offers
what you usually buy, answerable by voice.

Suggestions blend repurchase cadence, seasonality, substitutes and complements, then
diversify. One reducer backs both voice and taps, so undo is a single snapshot.
