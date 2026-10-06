import { describe, expect, it } from 'vitest';
import { fragments, maxEdits, processTerm, stem, transpositions } from './terms.js';

describe('stem', () => {
  it.each([
    ['shoes', 'shoe'],
    ['watches', 'watch'],
    ['glasses', 'glass'],
    ['accessories', 'accessory'],
    ['laptops', 'laptop'],
    ['dress', 'dress'],
    ['bus', 'bus'],
  ])('%s → %s', (word, expected) => {
    expect(stem(word)).toBe(expected);
  });

  it('is idempotent', () => {
    for (const word of ['shoes', 'watches', 'accessories', 'glasses']) expect(stem(stem(word))).toBe(stem(word));
  });
});

describe('processTerm', () => {
  it('normalises case and accents, and drops filler and one-letter words', () => {
    expect(processTerm('Crème')).toBe('creme');
    expect(processTerm('for')).toBeNull();
    expect(processTerm('s')).toBeNull();
  });
});

describe('fragments', () => {
  it('yields suffixes of at least 4 letters', () => {
    expect(fragments('smartphone')).toContain('phone');
    expect(fragments('phone')).toEqual(['hone']);
    expect(fragments('shoe')).toEqual([]);
  });
});

describe('typo tolerance', () => {
  it('allows more edits for longer words', () => {
    expect([maxEdits('tv'), maxEdits('shoe'), maxEdits('perfume'), maxEdits('sunglass')]).toEqual([0, 1, 1, 2]);
  });

  it('generates adjacent swaps', () => {
    expect(transpositions('iphnoe')).toContain('iphone');
    expect(transpositions('abc')).toEqual([]);
  });
});
