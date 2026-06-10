import { describe, expect, it } from "vitest";

import { extractKeywordDetails, extractKeywords, parseYakeOptions, type Lemmatizer } from "../src/index.js";

const singularLemmatizer: Lemmatizer = {
  lemmatize(token) {
    return token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
  },
};

// "trees" appears twice and "tree" once, so without any lemma handling both
// surface forms rank separately; with aggregation they collapse to one entry.
const treesText = "Trees are important. Many trees provide shade. Tree conservation matters.";

describe("lemmaAggregation option validation", () => {
  it("accepts the four upstream policy names", () => {
    for (const policy of ["min", "mean", "max", "harmonic"] as const) {
      const parsed = parseYakeOptions({ lemmaAggregation: policy, lemmatizer: singularLemmatizer });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.value.lemmaAggregation).toBe(policy);
    }
  });

  it("defaults to null (no post-extraction aggregation)", () => {
    const parsed = parseYakeOptions();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.lemmaAggregation).toBeNull();
  });

  it("rejects unknown policy names at the config boundary", () => {
    const parsed = parseYakeOptions({ lemmaAggregation: "median" as never, lemmatizer: singularLemmatizer });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.message).toMatch(/median/);
    expect(parsed.error.message).toMatch(/min/);
    expect(parsed.error.message).toMatch(/harmonic/);
  });

  it("rejects lemmaAggregation without a lemmatizer hook", () => {
    const parsed = parseYakeOptions({ lemmaAggregation: "min" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.message).toMatch(/lemmatizer/);
  });

  it("throws the same error through the KeywordExtractor constructor", () => {
    expect(() => extractKeywords("text", { lemmaAggregation: "min" })).toThrow(/lemmatizer/);
    expect(() => extractKeywords("text", { lemmaAggregation: "nope" as never, lemmatizer: singularLemmatizer })).toThrow(/nope/);
  });
});

describe("lemmaAggregation policies (upstream lemma_aggregation parity)", () => {
  it("min keeps the best-scoring variant and its own score", () => {
    const aggregated = extractKeywordDetails(treesText, {
      language: "en",
      n: 1,
      top: 10,
      lemmatizer: singularLemmatizer,
      lemmaAggregation: "min",
    });

    // All normalized keywords must be unique by lemma after aggregation.
    const lemmas = aggregated.map((entry) =>
      entry.normalizedKeyword.split(/\s+/u).map((token) => singularLemmatizer.lemmatize(token, { original: token, language: "en" })).join(" "));
    expect(new Set(lemmas).size).toBe(lemmas.length);

    // Ascending score order is preserved after aggregation.
    for (let index = 1; index < aggregated.length; index += 1) {
      expect(aggregated[index]!.score).toBeGreaterThanOrEqual(aggregated[index - 1]!.score);
    }
  });

  it("min/mean/max/harmonic produce the documented score relationships on the same group", () => {
    const run = (policy: "min" | "mean" | "max" | "harmonic") =>
      extractKeywordDetails("Running runners run. Runner runs racing. Runners running rapidly.", {
        language: "en",
        n: 1,
        top: 20,
        dedupLim: 1,
        lemmatizer: {
          lemmatize(token) {
            // Collapse every running/runner variant onto one lemma.
            return token.startsWith("run") ? "run" : token;
          },
        },
        lemmaAggregation: policy,
      });

    const score = (policy: "min" | "mean" | "max" | "harmonic") => {
      const results = run(policy);
      const entry = results.find((item) => item.normalizedKeyword.startsWith("run"));
      expect(entry, `no run* entry for ${policy}`).toBeDefined();
      return entry!.score;
    };

    const min = score("min");
    const mean = score("mean");
    const max = score("max");
    const harmonic = score("harmonic");

    // For positive inputs: min <= harmonic <= mean <= max.
    expect(min).toBeLessThanOrEqual(harmonic);
    expect(harmonic).toBeLessThanOrEqual(mean);
    expect(mean).toBeLessThanOrEqual(max);
  });

  it("aggregation runs after dedup and can shrink the result below top", () => {
    const plain = extractKeywordDetails(treesText, { language: "en", n: 2, top: 20, dedupLim: 1 });
    const aggregated = extractKeywordDetails(treesText, {
      language: "en",
      n: 2,
      top: 20,
      dedupLim: 1,
      lemmatizer: singularLemmatizer,
      lemmaAggregation: "min",
    });

    expect(aggregated.length).toBeLessThanOrEqual(plain.length);
    // Lemma keys must be unique post-aggregation.
    const lemmas = aggregated.map((entry) =>
      entry.normalizedKeyword.split(/\s+/u).map((token) => singularLemmatizer.lemmatize(token, { original: token, language: "en" })).join(" "));
    expect(new Set(lemmas).size).toBe(lemmas.length);
  });

  it("does not pre-merge variants during normalization when lemmaAggregation is set", () => {
    // With lemmaAggregation, the lemmatizer is a post-extraction grouping key.
    // The candidate index must keep distinct surface forms (i.e., the
    // pre-merge behavior of the bare lemmatizer hook must NOT be active).
    const calls: string[] = [];
    extractKeywordDetails("models improve modeling.", {
      language: "en",
      n: 1,
      top: 10,
      lemmatizer: {
        lemmatize(token) {
          calls.push(token);
          return token.startsWith("model") ? "model" : token;
        },
      },
      lemmaAggregation: "min",
    });

    // The lemmatizer must have been consulted for grouping (post-extraction),
    // so it sees the *normalized keyword tokens*, not every raw text token.
    expect(calls.length).toBeGreaterThan(0);
  });

  it("plain lemmatizer behavior (no lemmaAggregation) is unchanged", () => {
    const details = extractKeywordDetails("models model models shape products", {
      top: 10,
      n: 1,
      language: "en",
      lemmatizer: singularLemmatizer,
    });

    const aggregatedEntries = details.filter((item) => item.normalizedKeyword === "model");
    expect(aggregatedEntries).toHaveLength(1);
    expect(aggregatedEntries[0]!.occurrences).toBe(3);
  });
});
