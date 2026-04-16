import { describe, expect, it } from "vitest";

import { clearSimilarityCaches, getSimilarityCacheStats, sequenceSimilarity } from "../src/index.js";

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
});
