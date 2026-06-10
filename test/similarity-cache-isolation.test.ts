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
    sequenceSimilarity("kaggle", "google", isolated);
    Levenshtein.distance("beta", "betas", isolated);
    Levenshtein.ratio("gamma", "gamm", isolated);
    jaroSimilarity("martha", "marhta", isolated);

    // Distinct calls populate distinct entries in each underlying map.
    expect(isolated.stats().sequence).toBeGreaterThanOrEqual(1);
    expect(isolated.stats().distance).toBeGreaterThanOrEqual(1);
    expect(isolated.stats().ratio).toBeGreaterThanOrEqual(1);
    expect(isolated.stats().jaro).toBeGreaterThanOrEqual(1);

    // The same key only ever counts once (proves we are reading the cache).
    const sequenceBefore = isolated.stats().sequence;
    sequenceSimilarity("alpha", "alpha", isolated);
    expect(isolated.stats().sequence).toBe(sequenceBefore);
    const jaroBefore = isolated.stats().jaro;
    jaroSimilarity("martha", "marhta", isolated);
    expect(isolated.stats().jaro).toBe(jaroBefore);

    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0, jaro: 0 });
  });

  it("rejects non-positive or non-integer maxSize values", () => {
    for (const bad of [0, -1, -100, 1.5, NaN, Infinity, -Infinity]) {
      expect(() => createSimilarityCache({ maxSize: bad })).toThrow(/maxSize/);
    }
  });

  it("respects the maxSize option for bounded user caches", () => {
    const isolated = createSimilarityCache({ maxSize: 10 });

    for (let index = 0; index < 50; index += 1) {
      sequenceSimilarity(`a-${index}`, `b-${index}`, isolated);
      Levenshtein.distance(`c-${index}`, `d-${index}`, isolated);
      Levenshtein.ratio(`e-${index}`, `f-${index}`, isolated);
      jaroSimilarity(`g-${index}`, `h-${index}`, isolated);
    }

    const stats = isolated.stats();
    expect(stats.sequence).toBeLessThanOrEqual(10);
    expect(stats.distance).toBeLessThanOrEqual(10);
    expect(stats.ratio).toBeLessThanOrEqual(10);
    expect(stats.jaro).toBeLessThanOrEqual(10);
  });

  it("clear() drains an isolated cache without touching the module-level default", () => {
    clearSimilarityCaches();
    sequenceSimilarity("module", "module"); // populate default
    const moduleStatsBefore = getSimilarityCacheStats();
    expect(moduleStatsBefore.sequence).toBe(1);

    const isolated = createSimilarityCache();
    sequenceSimilarity("isolated", "isolated", isolated);
    jaroSimilarity("isolated-jaro", "isolated-jaroz", isolated);
    // Each unique pair adds exactly one entry to its bucket.
    expect(isolated.stats()).toEqual({ distance: 0, ratio: 0, sequence: 1, jaro: 1 });

    isolated.clear();
    expect(isolated.stats()).toEqual({ distance: 0, ratio: 0, sequence: 0, jaro: 0 });

    const moduleStatsAfter = getSimilarityCacheStats();
    expect(moduleStatsAfter).toEqual(moduleStatsBefore);
  });

  it("jaroSimilarity caches results in the supplied cache and returns the same value on a hit", () => {
    const isolated = createSimilarityCache();
    const baseline = jaroSimilarity("dwayne", "duane");

    expect(isolated.stats().jaro).toBe(0);
    const cold = jaroSimilarity("dwayne", "duane", isolated);
    expect(isolated.stats().jaro).toBe(1);
    const warm = jaroSimilarity("dwayne", "duane", isolated);
    expect(isolated.stats().jaro).toBe(1); // hit, no new entry
    expect(cold).toBe(baseline);
    expect(warm).toBe(baseline);
  });

  it("KeywordExtractor accepts a similarityCache option and routes seqm dedup through it", () => {
    const text = "machine learning machine learning deep learning";

    // First: capture what the no-cache path produces.
    const baseline = new KeywordExtractor({
      language: "en",
      n: 2,
      top: 5,
      dedupFunc: "seqm",
      dedupLim: 0.9,
    }).extractKeywords(text);

    // Now use an isolated cache. After clearing the module-level default,
    // running the isolated extractor must populate ONLY the isolated cache.
    clearSimilarityCaches();
    const isolated = createSimilarityCache();
    const result = new KeywordExtractor({
      language: "en",
      n: 2,
      top: 5,
      dedupFunc: "seqm",
      dedupLim: 0.9,
      similarityCache: isolated,
    }).extractKeywords(text);

    expect(result).toEqual(baseline);
    // Real seqm dedup over the repetitive input must produce at least a few
    // cached pairs (each consecutive comparison is recorded once).
    expect(isolated.stats().sequence).toBeGreaterThanOrEqual(2);
    expect(isolated.stats().distance).toBe(0);
    expect(isolated.stats().ratio).toBe(0);
    expect(isolated.stats().jaro).toBe(0);
    // Module-level cache must remain untouched when an isolated cache is provided.
    expect(getSimilarityCacheStats()).toEqual({ distance: 0, ratio: 0, sequence: 0, jaro: 0 });
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

describe("LRU eviction (reads refresh recency)", () => {
  // Each tuple drives one of the four cache read paths. The map getter
  // returns the bucket each helper memoizes into so the test can observe
  // which keys survived eviction.
  const paths: ReadonlyArray<[
    name: string,
    run: (a: string, b: string, cache: ReturnType<typeof createSimilarityCache>) => number,
    bucket: (cache: ReturnType<typeof createSimilarityCache>) => Map<string, number>,
  ]> = [
    ["sequenceSimilarity", (a, b, cache) => sequenceSimilarity(a, b, cache), (cache) => cache.sequence],
    ["Levenshtein.distance", (a, b, cache) => Levenshtein.distance(a, b, cache), (cache) => cache.distance],
    ["Levenshtein.ratio", (a, b, cache) => Levenshtein.ratio(a, b, cache), (cache) => cache.ratio],
    ["jaroSimilarity", (a, b, cache) => jaroSimilarity(a, b, cache), (cache) => cache.jaro],
  ];

  for (const [name, run, bucket] of paths) {
    it(`${name}: a recently-read entry survives eviction while the stale one is evicted`, () => {
      const cache = createSimilarityCache({ maxSize: 2 });

      const alphaValue = run("alpha one", "alpha two", cache); // insert alpha
      run("beta one", "beta two", cache); // insert beta — cache is now full
      expect(bucket(cache).size).toBe(2);

      // Cache hit on alpha refreshes its recency: beta becomes the LRU entry.
      expect(run("alpha one", "alpha two", cache)).toBe(alphaValue);

      run("gamma one", "gamma two", cache); // insert gamma — must evict beta
      const keys = [...bucket(cache).keys()];
      expect(bucket(cache).size).toBe(2);
      expect(keys.some((key) => key.includes("alpha")), `alpha evicted by ${name}; keys=${JSON.stringify(keys)}`).toBe(true);
      expect(keys.some((key) => key.includes("beta")), `beta survived in ${name}; keys=${JSON.stringify(keys)}`).toBe(false);
      expect(keys.some((key) => key.includes("gamma")), `gamma missing in ${name}; keys=${JSON.stringify(keys)}`).toBe(true);
    });
  }

  it("a cache hit does not change the entry count", () => {
    const cache = createSimilarityCache({ maxSize: 5 });
    sequenceSimilarity("one fish", "two fish", cache);
    const before = cache.sequence.size;
    sequenceSimilarity("one fish", "two fish", cache);
    sequenceSimilarity("one fish", "two fish", cache);
    expect(cache.sequence.size).toBe(before);
  });
});
