import { describe, expect, it } from "vitest";

import { createKeywordExtractor, extractKeywordDetails, type CandidateNormalizer, type StopwordProvider, type TextProcessor } from "../src/index.js";

const pipeSeparatedProcessor: TextProcessor = {
  splitSentences(text) {
    return [text];
  },
  tokenizeWords(text) {
    return text.split("|").map((token) => token.trim()).filter(Boolean);
  },
};

const customStopwords: StopwordProvider = {
  load() {
    return new Set(["alpha"]);
  },
};

describe("pluggable strategies", () => {
  it("supports custom text processing", () => {
    const extractor = createKeywordExtractor({
      language: "en",
      n: 2,
      top: 5,
      textProcessor: pipeSeparatedProcessor,
    });

    const details = extractor.extractKeywordDetails("alpha|beta|gamma");
    const keywords = details.map((item) => item.normalizedKeyword);

    expect(keywords).toContain("beta gamma");
  });

  it("supports custom stopword providers", () => {
    const details = extractKeywordDetails("alpha beta alpha beta", {
      language: "en",
      n: 1,
      top: 5,
      stopwordProvider: customStopwords,
    });

    const keywords = details.map((item) => item.normalizedKeyword);
    expect(keywords).not.toContain("alpha");
    expect(keywords).toContain("beta");
  });

  it("supports candidate filters on extracted results", () => {
    const baseline = extractKeywordDetails("agent swarms coordinate agent workflows", {
      language: "en",
      n: 2,
      top: 10,
    });
    const filtered = extractKeywordDetails("agent swarms coordinate agent workflows", {
      language: "en",
      n: 2,
      top: 10,
      candidateFilter(candidate) {
        return candidate.ngramSize > 1;
      },
    });

    expect(filtered.every((item) => item.ngramSize > 1)).toBe(true);
    // The filter must remove at least the unigrams that the baseline contained.
    expect(baseline.some((item) => item.ngramSize === 1)).toBe(true);
    expect(filtered.length).toBeLessThan(baseline.length);
    // Surviving multi-word candidates keep their baseline scores.
    for (const item of filtered) {
      const baselineMatch = baseline.find((entry) => entry.normalizedKeyword === item.normalizedKeyword);
      expect(baselineMatch).toBeDefined();
      expect(item.score).toBe(baselineMatch!.score);
    }
  });

  it("supports candidate normalizers", () => {
    const details = extractKeywordDetails("co-founder ecosystems", {
      language: "en",
      n: 1,
      top: 5,
      candidateNormalizer: {
        normalize(token) {
          return token.replaceAll("-", "");
        },
      },
    });

    expect(details.some((item) => item.normalizedKeyword === "cofounder")).toBe(true);
  });

  it("applies candidate normalizers exactly once per raw token", () => {
    const calls: string[] = [];
    const normalizer: CandidateNormalizer = {
      normalize(token, context) {
        calls.push(`${context.original}:${token}`);
        return token.replaceAll("-", "");
      },
    };

    const details = extractKeywordDetails("co-founder", {
      language: "en",
      n: 1,
      top: 5,
      candidateNormalizer: normalizer,
    });

    expect(details.some((item) => item.normalizedKeyword === "cofounder")).toBe(true);
    expect(calls).toEqual(["co-founder:co-founder"]);
  });

  it("supports custom keyword scorers — output ordering follows the user-supplied comparator", () => {
    const text = "agent swarms coordinate distributed teams";
    const baseline = extractKeywordDetails(text, { language: "en", n: 2, top: 10 });
    const reordered = extractKeywordDetails(text, {
      language: "en",
      n: 2,
      top: 10,
      keywordScorer(candidates) {
        // ngramSize DESC, then score ASC.
        return [...candidates].sort(
          (left, right) => right.ngramSize - left.ngramSize || left.score - right.score,
        );
      },
    });

    // Output is a permutation of the same candidate set (scorer doesn't add/remove).
    expect(reordered.map((entry) => entry.normalizedKeyword).sort()).toEqual(
      baseline.map((entry) => entry.normalizedKeyword).sort(),
    );
    // The custom comparator must produce a globally non-increasing ngramSize sequence.
    for (let index = 1; index < reordered.length; index += 1) {
      expect(reordered[index]!.ngramSize).toBeLessThanOrEqual(reordered[index - 1]!.ngramSize);
    }
    // Within each ngramSize bucket the comparator orders by score ASC.
    for (let index = 1; index < reordered.length; index += 1) {
      if (reordered[index]!.ngramSize === reordered[index - 1]!.ngramSize) {
        expect(reordered[index]!.score).toBeGreaterThanOrEqual(reordered[index - 1]!.score);
      }
    }
  });
});
