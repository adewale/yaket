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

          const first = extractKeywords(mutated, { lan: "en", n: 3, top: 10 });
          const second = extractKeywords(mutated, { lan: "en", n: 3, top: 10 });

          expect(second).toEqual(first);
          for (const [keyword, score] of first) {
            expect(keyword.trim().length).toBeGreaterThan(0);
            expect(Number.isFinite(score)).toBe(true);
            expect(score).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
