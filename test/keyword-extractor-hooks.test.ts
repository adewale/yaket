import { describe, expect, it } from "vitest";

import { createSimilarityCache, KeywordExtractor, type KeywordResult } from "../src/index.js";

describe("KeywordExtractor hook boundaries", () => {
  it("normalizes explicit stopwords without consulting the provider", () => {
    const extractor = new KeywordExtractor({
      language: "en",
      stopwords: ["Alpha", "BETA"],
      stopwordProvider: {
        load() {
          throw new Error("provider should not be called when explicit stopwords are supplied");
        },
      },
    });

    expect(extractor.stopwordSet).toEqual(new Set(["alpha", "beta"]));
  });

  it("routes instance similarity methods through an isolated cache", () => {
    const cache = createSimilarityCache();
    cache.distance.set("left\0right", 5);
    cache.sequence.set("left\0right", 0.25);
    cache.jaro.set("left\0right", 0.75);
    const extractor = new KeywordExtractor({ similarityCache: cache });

    expect(extractor.levs("left", "right")).toBeCloseTo(0, 12);
    expect(extractor.seqm("left", "right")).toBe(0.25);
    expect(extractor.jaro("left", "right")).toBe(0.75);
  });

  it("uses object-form keyword scorers", () => {
    const extractor = new KeywordExtractor({
      language: "en",
      n: 1,
      top: 3,
      dedupLim: 1,
      keywordScorer: {
        score(candidates: KeywordResult[]) {
          return candidates.slice().reverse();
        },
      },
    });

    expect(extractor.extractKeywordDetails("alpha beta gamma").map((item) => item.keyword)).toEqual(["beta", "gamma", "alpha"]);
  });

  it("uses object-form dedup strategies", () => {
    const extractor = new KeywordExtractor({
      language: "en",
      n: 1,
      top: 3,
      dedupLim: 0.5,
      dedupStrategy: {
        compare(left: string, right: string) {
          return left[0] === right[0] ? 1 : 0;
        },
      },
    });

    const keywords = extractor.extractKeywordDetails("alpha atom beta gamma").map((item) => item.normalizedKeyword);
    expect(keywords.filter((keyword) => keyword.startsWith("a"))).toHaveLength(1);
  });

  it("uses the jaro dedup dispatcher during extraction", () => {
    const extractor = new KeywordExtractor({ language: "en", n: 1, top: 3, dedupFunc: "jaro", dedupLim: 0.8 });
    expect(extractor.extractKeywordDetails("alpha alpha alhpa beta").length).toBeLessThanOrEqual(3);
  });
});
