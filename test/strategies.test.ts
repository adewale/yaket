import { describe, expect, it } from "vitest";

import { createKeywordExtractor, extractKeywordDetails, type StopwordProvider, type TextProcessor } from "../src/index.js";

const pipeSeparatedProcessor: TextProcessor = {
  splitSentences(text) {
    return [text];
  },
  tokenizeWords(text) {
    return text.split("|").map((token) => token.trim()).filter(Boolean);
  },
};

const customStopwords: StopwordProvider = {
  load() {
    return new Set(["alpha"]);
  },
};

describe("pluggable strategies", () => {
  it("supports custom text processing", () => {
    const extractor = createKeywordExtractor({
      lan: "en",
      n: 2,
      top: 5,
      textProcessor: pipeSeparatedProcessor,
    });

    const details = extractor.extractKeywordDetails("alpha|beta|gamma");
    const keywords = details.map((item) => item.normalizedKeyword);

    expect(keywords).toContain("beta gamma");
  });

  it("supports custom stopword providers", () => {
    const details = extractKeywordDetails("alpha beta alpha beta", {
      lan: "en",
      n: 1,
      top: 5,
      stopwordProvider: customStopwords,
    });

    const keywords = details.map((item) => item.normalizedKeyword);
    expect(keywords).not.toContain("alpha");
    expect(keywords).toContain("beta");
  });

  it("supports candidate filters on extracted results", () => {
    const details = extractKeywordDetails("agent swarms coordinate agent workflows", {
      lan: "en",
      n: 2,
      top: 10,
      candidateFilter(candidate) {
        return candidate.ngramSize > 1;
      },
    });

    expect(details.length).toBeGreaterThan(0);
    expect(details.every((item) => item.ngramSize > 1)).toBe(true);
  });
});
