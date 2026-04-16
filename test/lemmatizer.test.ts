import { describe, expect, it } from "vitest";

import { extractKeywordDetails, type Lemmatizer } from "../src/index.js";

const singularLemmatizer: Lemmatizer = {
  lemmatize(token) {
    return token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
  },
};

describe("lemmatizer hook", () => {
  it("can normalize related word forms before scoring", () => {
    const details = extractKeywordDetails("models model models shape products", {
      top: 5,
      n: 1,
      lemmatizer: singularLemmatizer,
    });

    const model = details.find((item) => item.normalizedKeyword === "model");
    expect(model).toBeDefined();
    expect(model!.occurrences).toBeGreaterThanOrEqual(3);
  });
});
