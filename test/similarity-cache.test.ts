import { describe, expect, it } from "vitest";

import { clearSimilarityCaches, extractKeywords, getSimilarityCacheStats, Levenshtein, sequenceSimilarity } from "../src/index.js";

describe("similarity cache diagnostics", () => {
  it("reports and clears cache usage", () => {
    clearSimilarityCaches();
    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0 });

    sequenceSimilarity("machine learning", "machine learning");
    const stats = getSimilarityCacheStats();
    expect(stats.sequence).toBeGreaterThan(0);

    clearSimilarityCaches();
    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0 });
  });

  it("stays bounded under many unique similarities", () => {
    clearSimilarityCaches();

    for (let index = 0; index < 22_500; index += 1) {
      sequenceSimilarity(`candidate-${index}`, `other-${index}`);
    }

    expect(getSimilarityCacheStats().sequence).toBeLessThanOrEqual(20_000);
  });

  it("keeps Levenshtein distance and ratio caches bounded too", () => {
    clearSimilarityCaches();

    for (let index = 0; index < 22_500; index += 1) {
      Levenshtein.distance(`distance-${index}`, `other-${index}`);
      Levenshtein.ratio(`ratio-${index}`, `other-${index}`);
    }

    const stats = getSimilarityCacheStats();
    expect(stats.distance).toBeLessThanOrEqual(20_000);
    expect(stats.ratio).toBeLessThanOrEqual(20_000);
  });

  it("remains deterministic regardless of cache warmness", () => {
    const text = "Google is acquiring data science community Kaggle. Sources tell us that Google is acquiring Kaggle, a platform that hosts data science and machine learning competitions.";

    clearSimilarityCaches();
    const cold = extractKeywords(text, { language: "en", n: 3, top: 10, dedupFunc: "seqm" });

    for (let index = 0; index < 5_000; index += 1) {
      sequenceSimilarity(`warm-${index}`, `other-${index}`);
    }

    const warm = extractKeywords(text, { language: "en", n: 3, top: 10, dedupFunc: "seqm" });
    expect(warm).toEqual(cold);
  });

  it("does not change levs-based extraction after heavy cache churn", () => {
    const text = "machine learning machine learning deep learning";

    clearSimilarityCaches();
    const cold = extractKeywords(text, { language: "en", n: 2, top: 5, dedupFunc: "levs", dedupLim: 0.9 });

    for (let index = 0; index < 15_000; index += 1) {
      Levenshtein.distance(`candidate-${index}`, `alternative-${index}`);
      sequenceSimilarity(`candidate-${index}`, `alternative-${index}`);
    }

    const warm = extractKeywords(text, { language: "en", n: 2, top: 5, dedupFunc: "levs", dedupLim: 0.9 });
    expect(warm).toEqual(cold);
  });
});
