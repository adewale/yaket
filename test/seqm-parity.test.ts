import { describe, expect, it } from "vitest";

import { createKeywordExtractor } from "../src/index.js";

describe("seqm parity examples", () => {
  it("matches upstream YAKE examples for representative pairs", () => {
    const extractor = createKeywordExtractor({ dedupFunc: "seqm" });

    expect(extractor.seqm("learning deep", "deep learning")).toBe(0);
    expect(extractor.seqm("machine learning", "machine learning")).toBe(1);
    expect(extractor.seqm("agent swarms", "agents")).toBeCloseTo(0.40636363636363637, 14);
    expect(extractor.seqm("google cloud platform", "cloud platform")).toBe(0);
    expect(extractor.seqm("cooperative context aware", "context aware")).toBeCloseTo(0.6666666666666666, 14);
  });
});
