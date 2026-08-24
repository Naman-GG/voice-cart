/** Text normalisation helpers shared by the parser and the catalog index. */

const APOSTROPHES = /['’ʼ`]/g;
const PUNCTUATION = /[.,!?;:"|/\\()[\]{}—–_*।॥]/g;

/** Lowercase, strip punctuation (keeping $ and decimals) and collapse spaces. */
export function normalize(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[₹]/g, "$")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(APOSTROPHES, "")
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Naive but predictable English singulariser — good enough for grocery nouns. */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (/(ss|us|is|as)$/.test(word)) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(ch|sh|x|z|s)es$/.test(word)) return word.slice(0, -2);
  if (/oes$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

export function tokenize(input: string): string[] {
  const normalized = normalize(input);
  return normalized ? normalized.split(" ") : [];
}

/** Token list with English plurals folded away, used for lexicon lookups. */
export function lemmas(input: string): string[] {
  return tokenize(input).map(singularize);
}

/** Levenshtein distance, capped for speed — tolerates speech-to-text slips. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** True when the strings are close enough to be the same spoken word. */
export function fuzzyEquals(a: string, b: string): boolean {
  if (a === b) return true;
  const tolerance = a.length <= 4 ? 0 : a.length <= 7 ? 1 : 2;
  if (tolerance === 0) return false;
  return editDistance(a, b, tolerance) <= tolerance;
}

/** Detects Devanagari so we can pick the right response language. */
export function hasDevanagari(input: string): boolean {
  return /[ऀ-ॿ]/.test(input);
}

/** Devanagari combining marks: vowel signs, anusvara, nukta, virama. */
const DEVANAGARI_MARKS = /[\u0900-\u0903\u093A-\u094D\u0951-\u0957\u0962\u0963\u200C\u200D]/g;

/**
 * Consonant skeleton of a Devanagari word, with vowel signs stripped.
 *
 * Speech-to-text slips in Indic scripts land overwhelmingly on the vowel
 * marks rather than the consonants — "अंडे" comes back as "अंदि" — and raw
 * code-point edit distance is a poor fit because a four-character Devanagari
 * word carries as much information as a much longer Latin one. Comparing
 * skeletons recovers those cases without loosening matching generally.
 */
export function devanagariSkeleton(text: string): string {
  return text.replace(DEVANAGARI_MARKS, "");
}
