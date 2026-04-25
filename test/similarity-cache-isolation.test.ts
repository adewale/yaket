import { describe, expect, it } from "vitest";

import {
  KeywordExtractor,
  Levenshtein,
  clearSimilarityCaches,
  createSimilarityCache,
  getSimilarityCacheStats,
  jaroSimilarity,
  levenshteinSimilarity,
  sequenceSimilarity,
} from "../src/index.js";

describe("configurable similarity caches", () => {
  it("createSimilarityCache returns an isolated cache that does not leak into the module-level default", () => {
    clearSimilarityCaches();

    const isolated = createSimilarityCache();
    sequenceSimilarity("alpha", "alpha", isolated);
    Levenshtein.distance("beta", "betas", isolated);
    Levenshtein.ratio("gamma", "gamm", isolated);

    expect(isolated.stats()).toEqual({
      distance: expect.any(Number),
      ratio: expect.any(Number),
      sequence: expect.any(Number),
    });
    expect(isolated.stats().sequence).toBeGreaterThan(0);
    expect(isolated.stats().distance).toBeGreaterThan(0);

    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0 });
  });

  it("respects the maxSize option for bounded user caches", () => {
    const isolated = createSimilarityCache({ maxSize: 10 });

    for (let index = 0; index < 50; index += 1) {
      sequenceSimilarity(`a-${index}`, `b-${index}`, isolated);
      Levenshtein.distance(`c-${index}`, `d-${index}`, isolated);
      Levenshtein.ratio(`e-${index}`, `f-${index}`, isolated);
    }

    const stats = isolated.stats();
    expect(stats.sequence).toBeLessThanOrEqual(10);
    expect(stats.distance).toBeLessThanOrEqual(10);
    expect(stats.ratio).toBeLessThanOrEqual(10);
  });

  it("clear() drains an isolated cache without touching the module-level default", () => {
    clearSimilarityCaches();
    sequenceSimilarity("module", "module"); // populate default
    const moduleStatsBefore = getSimilarityCacheStats();

    const isolated = createSimilarityCache();
    sequenceSimilarity("isolated", "isolated", isolated);
    expect(isolated.stats().sequence).toBeGreaterThan(0);

    isolated.clear();
    expect(isolated.stats()).toEqual({ distance: 0, ratio: 0, sequence: 0 });

    const moduleStatsAfter = getSimilarityCacheStats();
    expect(moduleStatsAfter).toEqual(moduleStatsBefore);
  });

  it("KeywordExtractor accepts a similarityCache option and routes seqm dedup through it", () => {
    clearSimilarityCaches();
    const isolated = createSimilarityCache();

    const text = "machine learning machine learning deep learning";
    const extractor = new KeywordExtractor({
      language: "en",
      n: 2,
      top: 5,
      dedupFunc: "seqm",
      dedupLim: 0.9,
      similarityCache: isolated,
    });

    const result = extractor.extractKeywords(text);
    expect(result.length).toBeGreaterThan(0);
    expect(isolated.stats().sequence).toBeGreaterThan(0);
    // Module-level cache must remain untouched when an isolated cache is provided.
    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0 });
  });

  it("levenshteinSimilarity and jaroSimilarity also accept the cache parameter without behavior change", () => {
    const isolated = createSimilarityCache();
    const baseline = levenshteinSimilarity("kitten", "sitting");
    const through = levenshteinSimilarity("kitten", "sitting", isolated);
    expect(through).toBe(baseline);

    const jaroBaseline = jaroSimilarity("martha", "marhta");
    const jaroThrough = jaroSimilarity("martha", "marhta", isolated);
    expect(jaroThrough).toBe(jaroBaseline);
  });
});
