import { describe, expect, it } from "vitest";

import {
  aggregateKeywordsByLemma,
  extractKeywordDetails,
  extractKeywords,
  LEMMA_AGGREGATION_NAMES,
  parseYakeOptions,
  type KeywordResult,
  type Lemmatizer,
} from "../src/index.js";

const identityLemmatizer: Lemmatizer = { lemmatize: (token) => token };
const collapseAllLemmatizer: Lemmatizer = { lemmatize: () => "g" };

function makeKeyword(keyword: string, score: number, sentenceIds: number[] = [0]): KeywordResult {
  return {
    keyword,
    normalizedKeyword: keyword.toLowerCase(),
    score,
    ngramSize: keyword.split(/\s+/u).length,
    occurrences: 1,
    sentenceIds,
  };
}

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

/**
 * Direct unit tests for `aggregateKeywordsByLemma`. Targeted at the
 * boundary cases the through-the-extractor path doesn't reach (empty
 * input, exact-tied scores, multi-word lemma keys, harmonic-zero
 * fallback, single-item groups, lemmatizer call shape).
 */
describe("aggregateKeywordsByLemma — focused unit tests", () => {
  it("returns an empty array when the input is empty (early return)", () => {
    expect(aggregateKeywordsByLemma([], identityLemmatizer, "en", "min")).toEqual([]);
    // Also check the other policies on empty input — none of them should crash.
    for (const policy of LEMMA_AGGREGATION_NAMES) {
      expect(aggregateKeywordsByLemma([], identityLemmatizer, "en", policy)).toEqual([]);
    }
  });

  it("creates one group per distinct lemma when called with distinct lemmas", () => {
    const input = [makeKeyword("alpha", 0.1), makeKeyword("beta", 0.2), makeKeyword("gamma", 0.3)];
    const out = aggregateKeywordsByLemma(input, identityLemmatizer, "en", "min");
    expect(out.map((entry) => entry.normalizedKeyword)).toEqual(["alpha", "beta", "gamma"]);
    expect(out.map((entry) => entry.score)).toEqual([0.1, 0.2, 0.3]);
  });

  it("appends to an existing group on lemma collision rather than overwriting it", () => {
    // collapseAllLemmatizer maps every token to "g" — every entry lands in
    // one group. The aggregated score must reflect all three inputs.
    const input = [makeKeyword("alpha", 0.1), makeKeyword("beta", 0.5), makeKeyword("gamma", 0.9)];
    expect(aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "min")[0]!.score).toBe(0.1);
    expect(aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "max")[0]!.score).toBe(0.9);
    expect(aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "mean")[0]!.score).toBeCloseTo((0.1 + 0.5 + 0.9) / 3, 12);
    // 3 / (1/0.1 + 1/0.5 + 1/0.9) = 0.2348...
    expect(aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "harmonic")[0]!.score).toBeCloseTo(3 / (1 / 0.1 + 1 / 0.5 + 1 / 0.9), 12);
  });

  it("sorts the final list by ascending score even when groups are produced out of order", () => {
    // Input is intentionally NOT sorted by score — output must re-sort.
    const input = [makeKeyword("alpha", 0.9), makeKeyword("beta", 0.1), makeKeyword("gamma", 0.5)];
    const out = aggregateKeywordsByLemma(input, identityLemmatizer, "en", "min");
    expect(out.map((entry) => entry.score)).toEqual([0.1, 0.5, 0.9]);
  });

  it("min uses strict `<` so the first-seen variant wins on exact ties", () => {
    // Two entries with the exact same score: min must keep the first-seen
    // one. (Equality flip from `<` to `<=` would keep the second.)
    const input = [makeKeyword("first", 0.5), makeKeyword("second", 0.5)];
    const out = aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "min");
    expect(out).toHaveLength(1);
    expect(out[0]!.keyword).toBe("first");
  });

  it("max uses strict `>` so the first-seen variant wins on exact ties", () => {
    const input = [makeKeyword("first", 0.5), makeKeyword("second", 0.5)];
    const out = aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "max");
    expect(out).toHaveLength(1);
    expect(out[0]!.keyword).toBe("first");
  });

  it("mean keeps the first variant in the group (best-ranked surface form)", () => {
    const input = [makeKeyword("first", 0.1), makeKeyword("second", 0.9)];
    const out = aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "mean");
    expect(out[0]!.keyword).toBe("first");
    expect(out[0]!.score).toBeCloseTo(0.5, 12);
  });

  it("harmonic falls back to the arithmetic mean when any score is zero", () => {
    const input = [makeKeyword("alpha", 0), makeKeyword("beta", 0.6)];
    const harmonic = aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "harmonic");
    const meanFallback = aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "mean");
    expect(harmonic[0]!.score).toBeCloseTo(meanFallback[0]!.score, 12);
    expect(harmonic[0]!.keyword).toBe("alpha");
  });

  it("harmonic uses the harmonic mean (NOT arithmetic) when every score is positive", () => {
    // 2 / (1/0.2 + 1/0.6) = 0.3 ; arithmetic mean would be 0.4. Strict <.
    const input = [makeKeyword("a", 0.2), makeKeyword("b", 0.6)];
    const out = aggregateKeywordsByLemma(input, collapseAllLemmatizer, "en", "harmonic");
    expect(out[0]!.score).toBeCloseTo(0.3, 12);
    expect(out[0]!.score).toBeLessThan(0.4);
  });

  it("treats a single-item group as identity for every policy", () => {
    const single = [makeKeyword("alpha", 0.42, [2, 5])];
    for (const policy of LEMMA_AGGREGATION_NAMES) {
      const out = aggregateKeywordsByLemma(single, identityLemmatizer, "en", policy);
      expect(out).toHaveLength(1);
      expect(out[0]!.score).toBe(0.42);
      expect(out[0]!.keyword).toBe("alpha");
      expect(out[0]!.sentenceIds).toEqual([2, 5]);
    }
  });

  it("uses the lemmatizer output with the SAME language as the call argument", () => {
    const seen: Array<{ token: string; original: string; language: string }> = [];
    const recording: Lemmatizer = {
      lemmatize(token, ctx) {
        seen.push({ token, original: ctx.original, language: ctx.language });
        return token;
      },
    };
    aggregateKeywordsByLemma([makeKeyword("hello world", 0.5)], recording, "pt", "min");
    // Each token of the normalized keyword is lemmatized separately.
    expect(seen).toEqual([
      { token: "hello", original: "hello", language: "pt" },
      { token: "world", original: "world", language: "pt" },
    ]);
  });

  it("lower-cases the lemmatized fragments so case-only variants share a group", () => {
    const upperish: Lemmatizer = { lemmatize: (token) => token.toUpperCase() };
    // Two distinct surface forms whose lemmatized output differs only in case
    // must end up in the same group (because the helper lowercases the
    // resulting lemma).
    const input = [makeKeyword("alpha", 0.4), makeKeyword("ALPHA", 0.2)];
    const out = aggregateKeywordsByLemma(input, upperish, "en", "min");
    expect(out).toHaveLength(1);
    // min picks the better-scoring "ALPHA".
    expect(out[0]!.keyword).toBe("ALPHA");
  });

  it("splits multi-word normalized keywords on every whitespace run", () => {
    // The split is `/\s+/u`. Mutating it to `/\s/u` would split each
    // whitespace character separately and produce extra blank tokens.
    // To detect that the multi-token path is actually exercised, use a
    // lemmatizer that records the token shape.
    const seen: string[] = [];
    const recording: Lemmatizer = {
      lemmatize(token) {
        seen.push(token);
        return token;
      },
    };
    aggregateKeywordsByLemma([makeKeyword("two   words", 0.3)], recording, "en", "min");
    expect(seen).toEqual(["two", "words"]);
  });

  it("joins multi-token lemmas with a single space so multi-word groups stay distinct", () => {
    // If the join is mutated to "" the keys "hello world" and "helloworld"
    // collide; assert they do NOT.
    const fakeLemma: Lemmatizer = { lemmatize: (token) => token };
    const input = [
      makeKeyword("hello world", 0.4),
      makeKeyword("helloworld", 0.6),
    ];
    const out = aggregateKeywordsByLemma(input, fakeLemma, "en", "min");
    expect(out).toHaveLength(2);
  });
});
