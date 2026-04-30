import { describe, expect, it } from "vitest";

import { DataCore, KeywordExtractor, extractKeywords } from "../src/index.js";

describe("KeywordExtractor default option values", () => {
  it("defaults language to 'en' when no language is supplied", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.language).toBe("en");
  });

  it("defaults n to 3", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.n).toBe(3);
  });

  it("defaults top to 20", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.top).toBe(20);
  });

  it("defaults dedupLim to 0.9", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.dedupLim).toBe(0.9);
  });

  it("defaults dedupFunc to 'seqm'", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.dedupFunc).toBe("seqm");
  });

  it("defaults windowSize to 1", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.windowSize).toBe(1);
  });

  it("DataCore also defaults windowSize to 1 when used directly", () => {
    const core = new DataCore("alpha beta gamma", new Set());
    const alpha = core.terms.get("alpha")!;
    const beta = core.terms.get("beta")!;
    const gamma = core.terms.get("gamma")!;

    expect(core.g.hasEdge(alpha.id, beta.id)).toBe(true);
    expect(core.g.hasEdge(beta.id, gamma.id)).toBe(true);
    expect(core.g.hasEdge(alpha.id, gamma.id)).toBe(false);
  });

  it("defaults features to null (compute every YAKE feature)", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.features).toBeNull();
  });

  it("uses default options end-to-end without explicit configuration", () => {
    const result = extractKeywords("Cloudflare Workers run JavaScript at the edge.");
    expect(result.length).toBeLessThanOrEqual(20); // default top
    expect(result.length).toBeGreaterThanOrEqual(3);
    // Defaults must produce sorted-ascending scores.
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index]![1]).toBeGreaterThanOrEqual(result[index - 1]![1]);
    }
    // Defaults must surface the expected proper-noun keyword.
    expect(result.map(([keyword]) => keyword)).toContain("Cloudflare Workers");
  });

  it("constructing with empty options object is equivalent to constructing with no argument", () => {
    const noArg = new KeywordExtractor();
    const emptyArg = new KeywordExtractor({});
    expect(emptyArg.config).toEqual(noArg.config);
  });
});
