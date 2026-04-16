import { describe, expect, it } from "vitest";

import { KeywordExtractor, Levenshtein, loadStopwords, tokenizeSentences } from "../src/index.js";
import { emptyTexts, referenceCases, stopwordOnlyText } from "./fixtures/reference.js";

const SCORE_TOLERANCE = 1e-12;

describe("reference fixtures", () => {
  for (const fixture of referenceCases) {
    it(fixture.name, () => {
      const actual = new KeywordExtractor(fixture.options).extractKeywords(fixture.text);
      expectKeywordScores(actual, fixture.expected);
    });
  }
});

describe("edge cases", () => {
  it("returns empty results for empty input", () => {
    for (const text of emptyTexts) {
      expect(new KeywordExtractor().extractKeywords(text)).toEqual([]);
    }
  });

  it("returns empty results for stopword-only input", () => {
    expect(new KeywordExtractor({ lan: "en", n: 1, top: 5 }).extractKeywords(stopwordOnlyText)).toEqual([]);
  });

  it("never returns phrases starting or ending with a stopword in boundary fixture", () => {
    const stopwords = loadStopwords("en");
    const result = new KeywordExtractor({ lan: "en", n: 2, top: 10 }).extractKeywords("alpha and beta and gamma");

    for (const [keyword] of result) {
      const words = keyword.toLowerCase().split(/\s+/);
      expect(stopwords.has(words[0]!)).toBe(false);
      expect(stopwords.has(words[words.length - 1]!)).toBe(false);
    }
  });

  it("is deterministic across repeated runs", () => {
    const text = referenceCases[0]!.text;
    const options = referenceCases[0]!.options;
    const extractor = new KeywordExtractor(options);

    const first = extractor.extractKeywords(text);
    const second = extractor.extractKeywords(text);
    const third = extractor.extractKeywords(text);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("keeps common abbreviations inside the same sentence", () => {
    expect(tokenizeSentences("Dr. Smith wrote this. Another sentence.")).toHaveLength(2);
    expect(tokenizeSentences("Mr. and Mrs. Doe arrived. They stayed.")).toHaveLength(2);
    expect(tokenizeSentences("The U.S. economy grew. Markets rose.")).toHaveLength(2);
  });
});

describe("similarity helpers", () => {
  it("matches upstream Levenshtein distance examples", () => {
    expect(Levenshtein.distance("hello", "hello")).toBe(0);
    expect(Levenshtein.distance("hello", "helo")).toBe(1);
    expect(Levenshtein.distance("abc", "xyz")).toBeGreaterThan(0);
  });

  it("matches upstream Levenshtein ratio examples", () => {
    expect(Levenshtein.ratio("hello", "hello")).toBe(1);
    expect(Levenshtein.ratio("hello", "helo")).toBeGreaterThan(0);
    expect(Levenshtein.ratio("hello", "helo")).toBeLessThan(1);
    expect(Levenshtein.ratio("abc", "xyz")).toBeGreaterThanOrEqual(0);
    expect(Levenshtein.ratio("abc", "xyz")).toBeLessThan(1);
  });
});

function expectKeywordScores(actual: Array<[string, number]>, expected: Array<[string, number]>): void {
  expect(actual).toHaveLength(expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    const [actualKeyword, actualScore] = actual[index]!;
    const [expectedKeyword, expectedScore] = expected[index]!;

    expect(actualKeyword).toBe(expectedKeyword);
    expect(Math.abs(actualScore - expectedScore)).toBeLessThanOrEqual(SCORE_TOLERANCE);
  }
}
