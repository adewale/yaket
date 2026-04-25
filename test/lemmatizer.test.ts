import { describe, expect, it } from "vitest";

import { extractKeywordDetails, type Lemmatizer } from "../src/index.js";

const singularLemmatizer: Lemmatizer = {
  lemmatize(token) {
    return token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
  },
};

describe("lemmatizer hook", () => {
  it("aggregates related unigram forms into a single normalized keyword", () => {
    const text = "models model models shape products";
    const plain = extractKeywordDetails(text, { top: 10, n: 1, language: "en" });
    const lemmatized = extractKeywordDetails(text, {
      top: 10,
      n: 1,
      language: "en",
      lemmatizer: singularLemmatizer,
    });

    expect(plain.map((item) => item.normalizedKeyword)).toEqual(expect.arrayContaining(["models", "model"]));

    const aggregated = lemmatized.filter((item) => item.normalizedKeyword === "model");
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]).toMatchObject({
      keyword: "models",
      normalizedKeyword: "model",
      ngramSize: 1,
      occurrences: 3,
      sentenceIds: [0],
    });

    const pluralOnly = plain.find((item) => item.normalizedKeyword === "models");
    expect(pluralOnly).toBeDefined();
    expect(aggregated[0]!.score).toBeLessThan(pluralOnly!.score);
  });

  it("aggregates multi-word phrases across sentences while preserving the first surface form", () => {
    const details = extractKeywordDetails("Models improve systems. Model improves system.", {
      top: 10,
      n: 2,
      language: "en",
      lemmatizer: singularLemmatizer,
    });

    const modelImprove = details.find((item) => item.normalizedKeyword === "model improve");
    const improveSystem = details.find((item) => item.normalizedKeyword === "improve system");
    const model = details.find((item) => item.normalizedKeyword === "model");

    expect(modelImprove).toMatchObject({
      keyword: "Models improve",
      normalizedKeyword: "model improve",
      occurrences: 2,
      sentenceIds: [0, 1],
    });
    expect(improveSystem).toMatchObject({
      keyword: "improve systems",
      normalizedKeyword: "improve system",
      occurrences: 2,
      sentenceIds: [0, 1],
    });
    expect(model).toMatchObject({
      keyword: "Models",
      normalizedKeyword: "model",
      occurrences: 2,
      sentenceIds: [0, 1],
    });
  });

  it("calls the lemmatizer once per raw token with original-token context", () => {
    const calls: Array<{ token: string; original: string; language: string }> = [];
    const recordingLemmatizer: Lemmatizer = {
      lemmatize(token, context) {
        calls.push({ token, original: context.original, language: context.language });
        return token;
      },
    };

    extractKeywordDetails("Models improve systems.", {
      top: 10,
      n: 2,
      language: "en",
      lemmatizer: recordingLemmatizer,
    });

    expect(calls).toEqual([
      { token: "models", original: "Models", language: "en" },
      { token: "improve", original: "improve", language: "en" },
      { token: "systems", original: "systems", language: "en" },
    ]);
  });

  it("rejects unsupported upstream-style string lemmatizer backends clearly", () => {
    expect(() => extractKeywordDetails("models model models", {
      top: 10,
      n: 1,
      language: "en",
      lemmatizer: "spacy" as unknown as Lemmatizer,
    })).toThrow(/not implemented in Yaket/i);
  });
});
