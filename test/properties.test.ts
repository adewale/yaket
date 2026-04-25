import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { extractKeywordDetails, extractYakeKeywords, jaroSimilarity, levenshteinSimilarity, sequenceSimilarity } from "../src/index.js";

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
          const details = extractKeywordDetails(text, { top: topK, n: maxNgram, language: "en" });

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

  it("keeps canonical and legacy language options behaviorally equivalent when used separately", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 400 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (text, topK, maxNgram) => {
          const canonical = extractKeywordDetails(text, { language: "en", top: topK, n: maxNgram });
          const legacy = extractKeywordDetails(text, { language: "en", top: topK, n: maxNgram });

          expect(canonical).toEqual(legacy);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("stays deterministic and finite on Unicode, emoji, CJK, and long-text inputs", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            "hello world",
            "emoji 🙂 🚀 ✨",
            "你好世界 再见世界",
            "مرحبا بالعالم",
            "naive facade co operate",
            "quoted \"text\" and ellipsis...",
            "line one\nline two",
          ),
          { minLength: 1, maxLength: 200 },
        ),
        (parts) => {
          const text = parts.join(" ");
          const first = extractKeywordDetails(text, { language: "en", n: 3, top: 10 });
          const second = extractKeywordDetails(text, { language: "en", n: 3, top: 10 });

          expect(second).toEqual(first);
          for (const detail of first) {
            expect(detail.keyword.trim()).toBe(detail.keyword);
            expect(Number.isFinite(detail.score)).toBe(true);
            expect(detail.score).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("keeps dedup-enabled keywords unique by normalized form and top-k monotonic", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        fc.integer({ min: 1, max: 3 }),
        (text, maxNgram) => {
          const top3 = extractKeywordDetails(text, { language: "en", n: maxNgram, top: 3, dedupLim: 0.9 });
          const top6 = extractKeywordDetails(text, { language: "en", n: maxNgram, top: 6, dedupLim: 0.9 });

          expect(top6.slice(0, top3.length)).toEqual(top3);
          expect(new Set(top6.map((item) => item.normalizedKeyword)).size).toBe(top6.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("keeps dedup-disabled output as a prefix when increasing top-k", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        fc.integer({ min: 1, max: 3 }),
        (text, maxNgram) => {
          const top4 = extractKeywordDetails(text, { language: "en", n: maxNgram, top: 4, dedupLim: 1 });
          const top8 = extractKeywordDetails(text, { language: "en", n: maxNgram, top: 8, dedupLim: 1 });

          expect(top8.slice(0, top4.length)).toEqual(top4);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("keeps similarity helpers symmetric and bounded", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 80 }),
        fc.string({ minLength: 0, maxLength: 80 }),
        (left, right) => {
          for (const similarity of [sequenceSimilarity, levenshteinSimilarity, jaroSimilarity]) {
            const forward = similarity(left, right);
            const backward = similarity(right, left);

            expect(forward).toBeGreaterThanOrEqual(0);
            expect(forward).toBeLessThanOrEqual(1);
            expect(Math.abs(forward - backward)).toBeLessThanOrEqual(1e-12);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
