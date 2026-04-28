import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { extractKeywords } from "../src/index.js";
import { referenceCases } from "./fixtures/reference.js";

describe("mutation-style fuzzing over known-good fixtures", () => {
  it("does not crash or become nondeterministic on punctuation mutations", () => {
    const baseText = referenceCases[0]!.text;

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("!", "?", ",", "\n", "\t", "  ", " \" "), { minLength: 1, maxLength: 12 }),
        (mutations) => {
          const mutated = mutations.reduce((text, mutation, index) => {
            const position = Math.min(text.length, (index + 1) * 17);
            return `${text.slice(0, position)}${mutation}${text.slice(position)}`;
          }, baseText);

          const first = extractKeywords(mutated, { language: "en", n: 3, top: 10 });
          const second = extractKeywords(mutated, { language: "en", n: 3, top: 10 });

          expect(second).toEqual(first);
          // Output must remain ascending by score.
          for (let index = 1; index < first.length; index += 1) {
            expect(first[index]![1]).toBeGreaterThanOrEqual(first[index - 1]![1]);
          }
          // Keywords are unique, trimmed, and have finite positive scores.
          const keywords = first.map(([keyword]) => keyword);
          expect(new Set(keywords).size).toBe(keywords.length);
          for (const [keyword, score] of first) {
            expect(keyword).toBe(keyword.trim());
            expect(keyword.length).toBeGreaterThanOrEqual(1);
            expect(Number.isFinite(score)).toBe(true);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
