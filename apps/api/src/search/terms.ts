/** Words that carry no product meaning in a shopping query. */
const FILLER_WORDS = new Set([
  'a', 'an', 'and', 'any', 'at', 'by', 'for', 'from', 'i', 'in', 'is', 'me', 'my', 'of', 'on', 'or', 'some', 'the', 'to', 'with',
]);

const MIN_FRAGMENT_LENGTH = 4;

/** Light plural stemming so "shoes" and "shoe", "watches" and "watch" meet. Idempotent. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Normalises one token; null drops it (too short or a filler word). */
export function processTerm(token: string): string | null {
  const word = token
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (word.length < 2 || FILLER_WORDS.has(word)) return null;
  return stem(word);
}

/**
 * Proper suffixes of a word, for matching inside compound names: "smartphone" yields
 * "phone" among others, so a search for "phone" finds it.
 */
export function fragments(word: string): string[] {
  const out: string[] = [];
  for (let start = 1; word.length - start >= MIN_FRAGMENT_LENGTH; start++) out.push(word.slice(start));
  return out;
}

/** Allowed typo distance by word length (spec FR-10). */
export function maxEdits(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

/** Each adjacent-letter swap ("iphnoe" → "iphone"), which Levenshtein would count as two edits. */
export function transpositions(word: string): string[] {
  if (word.length < 4) return [];
  const out = new Set<string>();
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] === word[i + 1]) continue;
    out.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
  }
  return [...out];
}
