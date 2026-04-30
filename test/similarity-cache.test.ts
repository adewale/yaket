import { describe, expect, it } from "vitest";

import { clearSimilarityCaches, createSimilarityCache, extractKeywords, getSimilarityCacheStats, jaroSimilarity, Levenshtein, sequenceSimilarity } from "../src/index.js";

describe("similarity cache diagnostics", () => {
  it("validates isolated cache size options", () => {
    expect(() => createSimilarityCache({ maxSize: 0 })).toThrow(/positive integer/);
    expect(() => createSimilarityCache({ maxSize: 1.5 })).toThrow(/positive integer/);
    expect(createSimilarityCache({ maxSize: 1 }).maxSize).toBe(1);
    expect(createSimilarityCache().maxSize).toBe(20_000);
  });

  it("uses existing cache entries before recomputing similarities", () => {
    const cache = createSimilarityCache();
    cache.ratio.set("left\0right", 0.123);
    cache.distance.set("left\0right", 123);
    cache.sequence.set("left\0right", 0.456);
    cache.jaro.set("left\0right", 0.789);

    expect(Levenshtein.ratio("left", "right", cache)).toBe(0.123);
    expect(Levenshtein.distance("left", "right", cache)).toBe(123);
    expect(sequenceSimilarity("left", "right", cache)).toBe(0.456);
    expect(jaroSimilarity("left", "right", cache)).toBe(0.789);
  });

  it("canonicalizes reversed cache keys", () => {
    const cache = createSimilarityCache();
    cache.distance.set("a\0b", 7);
    expect(Levenshtein.distance("b", "a", cache)).toBe(7);
  });

  it("reports and clears cache usage", () => {
    clearSimilarityCaches();
    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0, jaro: 0 });

    sequenceSimilarity("machine learning", "machine learning");
    const stats = getSimilarityCacheStats();
    expect(stats.sequence).toBeGreaterThan(0);

    clearSimilarityCaches();
    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0, jaro: 0 });
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

  it("matches canonical Jaro examples", () => {
    expect(jaroSimilarity("MARTHA", "MARHTA")).toBeCloseTo(0.9444444444, 10);
    expect(jaroSimilarity("DIXON", "DICKSONX")).toBeCloseTo(0.7666666667, 10);
    expect(jaroSimilarity("JELLYFISH", "SMELLYFISH")).toBeCloseTo(0.8962962963, 10);
    expect(jaroSimilarity("abc", "xyz")).toBe(0);
    expect(jaroSimilarity("", "abc")).toBe(0);
    expect(jaroSimilarity("abc", "")).toBe(0);
    expect(jaroSimilarity("", "")).toBe(1);
    expect(jaroSimilarity("ab", "ac")).toBeCloseTo(2 / 3, 12);
    expect(jaroSimilarity("CRATE", "TRACE")).toBeCloseTo(0.733333333333, 10);
  });

  it("pins sequence prefilter and scoring branch behavior", () => {
    expect(sequenceSimilarity("abc", "abc")).toBe(1);
    expect(sequenceSimilarity("abc", "def")).toBe(0);
    expect(sequenceSimilarity("abc", "abx")).toBeCloseTo(0.5, 12);
    expect(sequenceSimilarity("abc", "abcd")).toBe(0);
    expect(sequenceSimilarity("abcd", "abxd")).toBeCloseTo(0.6, 12);
    expect(sequenceSimilarity("abcde", "abxde")).toBeCloseTo(0.43333333333333335, 12);
    expect(sequenceSimilarity("alpha beta", "alpha gamma")).toBeCloseTo(0.5265734265734265, 12);
    expect(sequenceSimilarity("alpha beta", "alpha beta gamma")).toBeCloseTo(2 / 3, 12);
    expect(sequenceSimilarity("alpha beta", "alpha")).toBeCloseTo(0.5, 12);
    expect(sequenceSimilarity("alpha", "alpha beta")).toBeCloseTo(0.5, 12);
    expect(sequenceSimilarity("machine learning", "deep learning")).toBe(0);
    expect(sequenceSimilarity("foo  bar", "foo bar")).toBe(1);
    expect(sequenceSimilarity("foo   bar", "foo bar")).toBe(0);
    expect(sequenceSimilarity("ab123456z", "abcdefghz")).toBeCloseTo(0.34, 12);
    expect(sequenceSimilarity("ab123456789z", "ababcdefghiz")).toBe(0);
  });

  it("uses unambiguous cache keys for adjacent string pairs", () => {
    const cache = createSimilarityCache();
    expect(Levenshtein.distance("ab", "cd", cache)).toBe(2);
    expect(Levenshtein.distance("abc", "d", cache)).toBe(3);
    expect(cache.stats().distance).toBe(2);
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
