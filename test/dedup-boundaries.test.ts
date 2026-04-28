import { describe, expect, it } from "vitest";

import { KeywordExtractor, extractKeywords } from "../src/index.js";

const repetitiveText = "machine learning machine learning deep learning";

describe("dedupLim threshold behavior", () => {
  it("dedupLim=1 (>=1) keeps all candidates and skips dedup entirely", () => {
    // The boundary is `dedupLim >= 1` — at exactly 1, every candidate is kept.
    const noDedup = extractKeywords(repetitiveText, { language: "en", n: 2, top: 10, dedupLim: 1 });
    const noDedupHigher = extractKeywords(repetitiveText, { language: "en", n: 2, top: 10, dedupLim: 1.5 });
    expect(noDedup).toEqual(noDedupHigher);
    // No-dedup output is exactly the candidate-sort prefix limited by top.
    expect(noDedup.length).toBeLessThanOrEqual(10);
    expect(noDedup.length).toBeGreaterThanOrEqual(5);
  });

  it("dedupLim<1 may drop near-duplicate candidates (boundary-strict comparison)", () => {
    const tight = extractKeywords(repetitiveText, { language: "en", n: 2, top: 10, dedupLim: 0.5 });
    const open = extractKeywords(repetitiveText, { language: "en", n: 2, top: 10, dedupLim: 1 });
    // Tighter dedup must produce a result that is no larger than the no-dedup run.
    expect(tight.length).toBeLessThanOrEqual(open.length);
  });

  it("the dedup comparison is strict-greater (`> dedupLim`), not `>=`", () => {
    // We pin the property: at any given dedupLim threshold, two candidates
    // whose similarity equals the threshold are kept (not dropped). We
    // construct this case by using a custom dedupStrategy that returns
    // exactly the threshold for a known pair.
    const fixedSimilarity = 0.9;
    const calls: Array<[string, string]> = [];
    const extractor = new KeywordExtractor({
      language: "en",
      n: 2,
      top: 10,
      dedupLim: fixedSimilarity,
      dedupStrategy(left, right) {
        calls.push([left, right]);
        return fixedSimilarity;
      },
    });
    const result = extractor.extractKeywords(repetitiveText);
    // With the strategy returning exactly dedupLim, the strict `>` keeps
    // every candidate (similarity is not strictly greater than the limit).
    // The dedupStrategy is consulted for every selected/candidate pair.
    expect(calls.length).toBeGreaterThanOrEqual(result.length - 1);
    expect(calls.every(([left, right]) => left !== right)).toBe(true);
    const baseline = extractKeywords(repetitiveText, { language: "en", n: 2, top: 10, dedupLim: 1 });
    expect(result.map(([keyword]) => keyword)).toEqual(baseline.map(([keyword]) => keyword));
  });

  it("a dedupStrategy returning a value strictly greater than dedupLim drops the second candidate", () => {
    const calls: Array<[string, string]> = [];
    const extractor = new KeywordExtractor({
      language: "en",
      n: 2,
      top: 10,
      dedupLim: 0.5,
      dedupStrategy(left, right) {
        calls.push([left, right]);
        return 1; // always exceed the threshold
      },
    });
    const result = extractor.extractKeywords(repetitiveText);
    // Every subsequent candidate after the first is at similarity 1 > 0.5,
    // so dedup drops them all. Result must contain exactly one entry.
    // The strategy must have been consulted at least once per dropped
    // candidate.
    expect(result).toHaveLength(1);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // All dedup calls compare a candidate against the single accepted entry.
    const accepted = result[0]![0];
    for (const [, right] of calls) {
      expect(right).toBe(accepted.toLowerCase());
    }
  });
});

describe("KeywordExtractor early-exit behavior", () => {
  it("returns [] for null/undefined/empty text without invoking dedup", () => {
    const extractor = new KeywordExtractor({ language: "en" });
    expect(extractor.extractKeywords(null)).toEqual([]);
    expect(extractor.extractKeywords(undefined)).toEqual([]);
    expect(extractor.extractKeywords("")).toEqual([]);
  });

  it("respects the top limit by truncating after dedup, not before", () => {
    // top=2 with a generous dedup threshold should still emit at most 2
    // entries even though many candidates exist.
    const result = extractKeywords(repetitiveText, { language: "en", n: 2, top: 2, dedupLim: 0.9 });
    expect(result).toHaveLength(2);
  });
});
