import { describe, expect, it } from "vitest";

import { KeywordExtractor } from "../src/index.js";

describe("canonical-only options surface (no Bobbin/Python aliases)", () => {
  it("rejects the legacy `lan` option at the type level and at runtime", () => {
    expect(() => {
      // @ts-expect-error -- `lan` removed in 0.6, use `language`
      new KeywordExtractor({ lan: "en" });
    }).toThrow(/lan/);
  });

  it("rejects the legacy `dedup_lim` option at the type level and at runtime", () => {
    expect(() => {
      // @ts-expect-error -- `dedup_lim` removed in 0.6, use `dedupLim`
      new KeywordExtractor({ language: "en", dedup_lim: 0.5 });
    }).toThrow(/dedup_lim/);
  });

  it("rejects the legacy `dedup_func` option at the type level and at runtime", () => {
    expect(() => {
      // @ts-expect-error -- `dedup_func` removed in 0.6, use `dedupFunc`
      new KeywordExtractor({ language: "en", dedup_func: "seqm" });
    }).toThrow(/dedup_func/);
  });

  it("rejects the legacy `windowsSize` and `window_size` options at the type level and at runtime", () => {
    expect(() => {
      // @ts-expect-error -- `windowsSize` removed in 0.6, use `windowSize`
      new KeywordExtractor({ language: "en", windowsSize: 2 });
    }).toThrow(/windowsSize/);
    expect(() => {
      // @ts-expect-error -- `window_size` removed in 0.6, use `windowSize`
      new KeywordExtractor({ language: "en", window_size: 2 });
    }).toThrow(/window_size/);
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

  it("dedup-function rejection error message includes the bad value and the valid choices", () => {
    const cases: Array<[string, RegExp]> = [
      ["leve", /leve/],
      ["jaro_winkler", /jaro_winkler/],
      ["sequencematcher", /sequencematcher/],
      ["totally-made-up", /totally-made-up/],
    ];
    for (const [bad, valuePattern] of cases) {
      expect(() => new KeywordExtractor({ language: "en", dedupFunc: bad })).toThrow(valuePattern);
      // Error must list every accepted alternative so callers can self-correct.
      expect(() => new KeywordExtractor({ language: "en", dedupFunc: bad })).toThrow(/seqm/);
      expect(() => new KeywordExtractor({ language: "en", dedupFunc: bad })).toThrow(/levs/);
      expect(() => new KeywordExtractor({ language: "en", dedupFunc: bad })).toThrow(/jaro/);
    }
  });

  it("rejects legacy snake_case option keys at runtime even when the type system is bypassed", () => {
    // The TypeScript signature already rejects these (covered by the @ts-expect-error
    // tests above). The runtime guard catches callers who construct options
    // from a plain JS object or JSON payload, so a snake_case key never
    // silently falls back to the default.
    const legacyKeys: Array<[string, unknown]> = [
      ["lan", "pt"],
      ["dedup_lim", 0.5],
      ["dedup_func", "seqm"],
      ["windowsSize", 2],
      ["window_size", 2],
    ];
    for (const [key, value] of legacyKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional shape probe
      expect(() => new KeywordExtractor({ [key]: value } as any)).toThrow(new RegExp(key));
    }
  });

  it("rejects legacy snake_case option keys even when they appear on the prototype chain", () => {
    // Some callers build option bags with Object.create(...) or class-style
    // hierarchies. The runtime guard must catch inherited legacy keys too,
    // not just own properties.
    const inheritedLegacy = Object.create({ lan: "pt" });
    inheritedLegacy.language = "en";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional shape probe
    expect(() => new KeywordExtractor(inheritedLegacy as any)).toThrow(/lan/);

    class LegacyOptions {
      language = "en";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional shape probe
    (LegacyOptions.prototype as any).dedup_func = "seqm";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional shape probe
    expect(() => new KeywordExtractor(new LegacyOptions() as any)).toThrow(/dedup_func/);
  });

  it("accepts the canonical dedup function names", () => {
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "seqm" })).not.toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "levs" })).not.toThrow();
    expect(() => new KeywordExtractor({ language: "en", dedupFunc: "jaro" })).not.toThrow();
  });
});
