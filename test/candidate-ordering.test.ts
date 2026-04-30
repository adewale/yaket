import { describe, expect, it } from "vitest";

import type { ComposedWord } from "../src/ComposedWord.js";
import { compareCandidates, isSlidingNgramTie } from "../src/KeywordExtractor.js";

function candidate(uniqueKw: string, size: number, h: number, order: number): ComposedWord {
  return { uniqueKw, size, h, order } as ComposedWord;
}

describe("candidate ordering helpers", () => {
  it("recognizes only same-size sliding 3-gram ties", () => {
    expect(isSlidingNgramTie(
      candidate("google kaggle data", 3, 1, 0),
      candidate("kaggle data science", 3, 1, 1),
    )).toBe(true);

    expect(isSlidingNgramTie(
      candidate("kaggle data science", 3, 1, 1),
      candidate("google kaggle data", 3, 1, 0),
    )).toBe(true);

    expect(isSlidingNgramTie(
      candidate("google kaggle", 2, 1, 0),
      candidate("kaggle data", 2, 1, 1),
    )).toBe(false);

    expect(isSlidingNgramTie(
      candidate("google kaggle data", 3, 1, 0),
      candidate("kaggle data science extra", 4, 1, 1),
    )).toBe(false);

    expect(isSlidingNgramTie(
      candidate("google kaggle data", 3, 1, 0),
      candidate("google cloud platform", 3, 1, 1),
    )).toBe(false);
  });

  it("orders by score first, insertion order for normal ties, and reverse order for sliding 3-gram ties", () => {
    expect(compareCandidates(
      candidate("alpha", 1, 0.1, 10),
      candidate("beta", 1, 0.2, 0),
    )).toBeLessThan(0);

    expect(compareCandidates(
      candidate("alpha", 1, 0.2, 10),
      candidate("beta", 1, 0.1, 0),
    )).toBeGreaterThan(0);

    expect(compareCandidates(
      candidate("alpha", 1, 0.1, 0),
      candidate("beta", 1, 0.1, 1),
    )).toBeLessThan(0);

    expect(compareCandidates(
      candidate("google kaggle data", 3, 0.1, 0),
      candidate("kaggle data science", 3, 0.1, 1),
    )).toBeGreaterThan(0);
  });
});
