import { describe, expect, it } from "vitest";

import {
  KeywordExtractor,
  extractKeywordDetails,
  type MultiWordScorer,
  type SingleWordScorer,
  type YakeOptions,
} from "../src/index.js";

describe("canonical options surface", () => {
  it("normalizes canonical option names onto extractor.config", () => {
    const extractor = new KeywordExtractor({
      language: "pt",
      top: 2,
      n: 1,
      dedupLim: 1,
      windowSize: 2,
    });

    expect(extractor.config.language).toBe("pt");
    expect(extractor.config.top).toBe(2);
    expect(extractor.config.n).toBe(1);
    expect(extractor.config.dedupLim).toBe(1);
    expect(extractor.config.windowSize).toBe(2);
  });

  it("keeps YakeOptions focused on the canonical names", () => {
    const options: YakeOptions = {
      language: "en",
      n: 2,
      top: 5,
      dedupLim: 0.9,
      dedupFunc: "seqm",
      windowSize: 1,
    };

    const result = extractKeywordDetails("Machine learning improves retrieval.", options);
    expect(result.length).toBeGreaterThan(0);
  });

  it("preserves surface case separately from normalized keywords", () => {
    const result = extractKeywordDetails("Google Google Kaggle", {
      language: "en",
      n: 1,
      top: 3,
      dedupLim: 1,
    });

    expect(result[0]?.keyword).toBe("Kaggle");
    expect(result[0]?.normalizedKeyword).toBe("kaggle");
  });
});

describe("first-class scoring hooks", () => {
  it("supports custom single-word scorers before multi-word composition", () => {
    const scorer: SingleWordScorer = {
      score(term) {
        return term.uniqueTerm === "gamma" ? 0.001 : 10;
      },
    };

    const details = extractKeywordDetails("alpha beta gamma", {
      language: "en",
      n: 1,
      top: 3,
      singleWordScorer: scorer,
    });

    expect(details[0]!.normalizedKeyword).toBe("gamma");
  });

  it("supports custom multi-word scorers separately from single-word scorers", () => {
    const scorer: MultiWordScorer = {
      score(candidate) {
        return candidate.size === 2 ? 0.001 : 10;
      },
    };

    const details = extractKeywordDetails("agent swarms coordinate teams", {
      language: "en",
      n: 2,
      top: 5,
      multiWordScorer: scorer,
    });

    expect(details[0]!.ngramSize).toBe(2);
  });
});
