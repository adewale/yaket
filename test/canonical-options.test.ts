import { describe, expect, it } from "vitest";

import { KeywordExtractor } from "../src/index.js";

describe("canonical-only options surface (no Bobbin/Python aliases)", () => {
  it("rejects the legacy `lan` option at the type level", () => {
    // @ts-expect-error -- `lan` removed in 0.6, use `language`
    new KeywordExtractor({ lan: "en" });
  });

  it("rejects the legacy `dedup_lim` option at the type level", () => {
    // @ts-expect-error -- `dedup_lim` removed in 0.6, use `dedupLim`
    new KeywordExtractor({ language: "en", dedup_lim: 0.5 });
  });

  it("rejects the legacy `dedup_func` option at the type level", () => {
    // @ts-expect-error -- `dedup_func` removed in 0.6, use `dedupFunc`
    new KeywordExtractor({ language: "en", dedup_func: "seqm" });
  });

  it("rejects the legacy `windowsSize` and `window_size` options at the type level", () => {
    // @ts-expect-error -- `windowsSize` removed in 0.6, use `windowSize`
    new KeywordExtractor({ language: "en", windowsSize: 2 });
    // @ts-expect-error -- `window_size` removed in 0.6, use `windowSize`
    new KeywordExtractor({ language: "en", window_size: 2 });
  });

  it("exposes config.language instead of config.lan", () => {
    const extractor = new KeywordExtractor({ language: "pt" });
    expect(extractor.config.language).toBe("pt");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional shape probe
    expect((extractor.config as any).lan).toBeUndefined();
  });

  it("removes the snake_case extract_keywords method alias", () => {
    const extractor = new KeywordExtractor({ language: "en" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional shape probe
    expect((extractor as any).extract_keywords).toBeUndefined();
  });

  it("rejects unknown dedup function names instead of silently aliasing them", () => {
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "leve" })).toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "jaro_winkler" })).toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "sequencematcher" })).toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "totally-made-up" })).toThrow();
  });

  it("accepts the canonical dedup function names", () => {
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "seqm" })).not.toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "levs" })).not.toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "jaro" })).not.toThrow();
  });
});
