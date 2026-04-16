import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { extractYakeKeywords } from "../src/index.js";

describe("property-based invariants", () => {
  it("never exceeds requested top-k and remains sorted", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 400 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (text, topK, maxNgram) => {
          const result = extractYakeKeywords(text, topK, maxNgram);

          expect(result.length).toBeLessThanOrEqual(topK);

          for (let index = 1; index < result.length; index += 1) {
            expect(result[index]!.score).toBeGreaterThanOrEqual(result[index - 1]!.score);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("is deterministic and returns unique trimmed keywords", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 400 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (text, topK, maxNgram) => {
          const first = extractYakeKeywords(text, topK, maxNgram);
          const second = extractYakeKeywords(text, topK, maxNgram);

          expect(second).toEqual(first);

          const keywords = first.map((item) => item.keyword);
          expect(new Set(keywords).size).toBe(keywords.length);

          for (const keyword of keywords) {
            expect(keyword).toBe(keyword.trim());
            expect(keyword.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
