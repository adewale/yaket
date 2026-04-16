import { describe, expect, it } from "vitest";

import { extractYakeKeywords } from "../src/index.js";

describe("Bobbin adapter", () => {
  it("preserves Bobbin's extractYakeKeywords shape", () => {
    const result = extractYakeKeywords(
      "Google is acquiring data science community Kaggle.",
      5,
      3,
    );

    expect(result.length).toBeLessThanOrEqual(5);

    for (const item of result) {
      expect(item).toHaveProperty("keyword");
      expect(item).toHaveProperty("score");
      expect(typeof item.keyword).toBe("string");
      expect(typeof item.score).toBe("number");
      expect(item.keyword).toBe(item.keyword.toLowerCase());
    }
  });

  it("uses maxNgram as the extractor n-gram limit", () => {
    const result = extractYakeKeywords(
      "machine learning systems improve machine learning workflows",
      10,
      1,
    );

    for (const item of result) {
      expect(item.keyword.split(/\s+/)).toHaveLength(1);
    }
  });
});
