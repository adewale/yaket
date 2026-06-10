import { describe, expect, it } from "vitest";

import { DataCore, DEFAULT_YAKE_OPTIONS, loadStopwords } from "../src/index.js";

/**
 * Direct-construction edge cases for `DataCore`. The candidate-generation
 * and feature paths are covered by `candidate-construction.test.ts`,
 * `candidate-ordering.test.ts`, and the parity layers; this file pins the
 * constructor defaults, term-index semantics, and document statistics for
 * callers that instantiate `DataCore` without going through
 * `KeywordExtractor`.
 */
describe("DataCore direct construction", () => {
  it("uses the shared public defaults when no config is supplied", () => {
    const core = new DataCore("alpha beta. Gamma delta.", new Set());

    expect(core.language).toBe(DEFAULT_YAKE_OPTIONS.language);
    // n=3 means freqNs is initialized for 1..3.
    expect(Object.keys(core.freqNs).map(Number).sort()).toEqual([1, 2, 3]);
    // Default tags to discard: unparseable + digit.
    expect([...core.tagsToDiscard].sort()).toEqual(["d", "u"]);
  });

  it("initializes freqNs slots for a custom n", () => {
    const core = new DataCore("alpha beta gamma delta", new Set(), { n: 5 });
    expect(Object.keys(core.freqNs).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("counts sentences and words for multi-sentence text", () => {
    const core = new DataCore("Alpha beta gamma. Delta epsilon!", new Set());
    expect(core.numberOfSentences).toBe(2);
    // Pure-punctuation tokens flush the word block without incrementing
    // the word counter, so only the 5 real words count.
    expect(core.numberOfWords).toBe(5);
    expect(core.sentencesStr).toHaveLength(2);
  });

  it("produces zero sentences and words for whitespace-only text", () => {
    const core = new DataCore("   \n\t  ", new Set());
    expect(core.numberOfSentences).toBe(0);
    expect(core.numberOfWords).toBe(0);
    expect(core.terms.size).toBe(0);
    expect(core.candidates.size).toBe(0);
  });

  it("trims a trailing plural-s from terms longer than three characters", () => {
    const core = new DataCore("models pens", new Set());
    expect(core.terms.has("model")).toBe(true);
    expect(core.terms.has("models")).toBe(false);
    // "pens" trims to "pen" (length > 3 applies to the original "pens").
    expect(core.terms.has("pen")).toBe(true);
  });

  it("does not trim short s-final words at or below three characters", () => {
    const core = new DataCore("gas is here", loadStopwords("en"));
    expect(core.terms.has("gas")).toBe(true);
    expect(core.terms.has("ga")).toBe(false);
  });

  it("marks stopwords and short terms as stopword terms", () => {
    const core = new DataCore("the model is xy", loadStopwords("en"));
    expect(core.terms.get("the")?.stopword).toBe(true);
    expect(core.terms.get("model")?.stopword).toBe(false);
    // Terms shorter than three characters after punctuation-stripping are
    // stopwords regardless of the stopword list.
    expect(core.terms.get("xy")?.stopword).toBe(true);
  });

  it("getTerm with saveNonSeen=false does not grow the term index", () => {
    const core = new DataCore("alpha beta", new Set());
    const before = core.terms.size;
    const probe = core.getTerm("zeta", false);
    expect(probe.tf).toBe(0);
    expect(core.terms.size).toBe(before);
  });

  it("getTerm returns the existing term object for repeated lookups", () => {
    const core = new DataCore("alpha alpha alpha", new Set());
    const first = core.getTerm("alpha");
    const second = core.getTerm("alpha");
    expect(first).toBe(second);
    expect(first.tf).toBe(3);
  });

  it("tracks term frequency across sentences in the occurs map", () => {
    const core = new DataCore("Alpha beta. Alpha gamma. Alpha delta.", new Set());
    const alpha = core.terms.get("alpha");
    expect(alpha).toBeDefined();
    expect(alpha!.tf).toBe(3);
    expect([...alpha!.occurs.keys()].sort()).toEqual([0, 1, 2]);
  });

  it("builds the co-occurrence graph between adjacent non-discarded terms", () => {
    const core = new DataCore("alpha beta", new Set(), { windowSize: 1 });
    const alpha = core.terms.get("alpha")!;
    const beta = core.terms.get("beta")!;
    expect(core.g.hasEdge(alpha.id, beta.id)).toBe(true);
    expect(core.g.getWeight(alpha.id, beta.id)).toBe(1);
    // Direction matters: beta never precedes alpha in this document.
    expect(core.g.hasEdge(beta.id, alpha.id)).toBe(false);
  });

  it("a discarded digit token occupies its window slot, blocking the link at windowSize 1", () => {
    // "42" is tagged "d" (digit) and discarded from co-occurrence, but it
    // still occupies a position in the word block. With windowSize 1, the
    // window from "beta" only reaches back to "42", so alpha–beta are NOT
    // linked. This matches upstream YAKE: the window indexes positions, not
    // surviving terms.
    const core = new DataCore("alpha 42 beta", new Set(), { windowSize: 1 });
    const alpha = core.terms.get("alpha")!;
    const beta = core.terms.get("beta")!;
    expect(core.g.hasEdge(alpha.id, beta.id)).toBe(false);

    // Widening the window past the digit restores the link.
    const wide = new DataCore("alpha 42 beta", new Set(), { windowSize: 2 });
    const wideAlpha = wide.terms.get("alpha")!;
    const wideBeta = wide.terms.get("beta")!;
    expect(wide.g.hasEdge(wideAlpha.id, wideBeta.id)).toBe(true);
  });

  it("counts composed-word frequency through addOrUpdateComposedWord", () => {
    const core = new DataCore("alpha beta alpha beta", new Set(), { n: 2 });
    const candidate = core.candidates.get("alpha beta");
    expect(candidate).toBeDefined();
    expect(candidate!.tf).toBe(2);
  });
});
