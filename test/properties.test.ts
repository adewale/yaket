import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { extractKeywordDetails, extractYakeKeywords } from "../src/index.js";

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

  it("returns finite positive scores and valid sentence metadata", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 400 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (text, topK, maxNgram) => {
          const details = extractKeywordDetails(text, { top: topK, n: maxNgram, lan: "en" });

          expect(details.length).toBeLessThanOrEqual(topK);
          for (const detail of details) {
            expect(detail.keyword.length).toBeGreaterThan(0);
            expect(detail.normalizedKeyword.length).toBeGreaterThan(0);
            expect(Number.isFinite(detail.score)).toBe(true);
            expect(detail.score).toBeGreaterThan(0);
            expect(detail.ngramSize).toBeGreaterThanOrEqual(1);
            if (detail.sentenceIds != null) {
              expect([...detail.sentenceIds].sort((left, right) => left - right)).toEqual(detail.sentenceIds);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
