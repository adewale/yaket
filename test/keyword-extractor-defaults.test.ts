import { describe, expect, it } from "vitest";

import { KeywordExtractor, extractKeywords } from "../src/index.js";

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

  it("defaults features to null (compute every YAKE feature)", () => {
    const extractor = new KeywordExtractor();
    expect(extractor.config.features).toBeNull();
  });

  it("uses default options end-to-end without explicit configuration", () => {
    const result = extractKeywords("Cloudflare Workers run JavaScript at the edge.");
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(20); // default top
  });

  it("constructing with empty options object is equivalent to constructing with no argument", () => {
    const noArg = new KeywordExtractor();
    const emptyArg = new KeywordExtractor({});
    expect(emptyArg.config).toEqual(noArg.config);
  });
});
