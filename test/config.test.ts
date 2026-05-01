import { describe, expect, it } from "vitest";

import { DEFAULT_YAKE_OPTIONS, parseYakeOptions } from "../src/index.js";

describe("parseYakeOptions", () => {
  it("returns canonical defaults from one shared source", () => {
    const parsed = parseYakeOptions();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value).toEqual(DEFAULT_YAKE_OPTIONS);
  });

  it("normalizes dedupFunc case once at the public boundary", () => {
    const parsed = parseYakeOptions({ dedupFunc: "JARO" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.dedupFunc).toBe("jaro");
  });

  it("rejects removed option aliases without constructing an extractor", () => {
    const parsed = parseYakeOptions({ lan: "pt" } as never);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.message).toMatch(/lan/);
    expect(parsed.error.message).toMatch(/language/);
  });

  it("rejects unknown feature names at the config boundary", () => {
    expect(parseYakeOptions({ features: ["wfreq", "KPF"] }).ok).toBe(true);

    const parsed = parseYakeOptions({ features: ["not-a-feature"] as never });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.message).toMatch(/Unknown feature/);
  });

  it("rejects unknown dedup functions at the config boundary", () => {
    const parsed = parseYakeOptions({ dedupFunc: "sequencematcher" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.message).toMatch(/sequencematcher/);
    expect(parsed.error.message).toMatch(/seqm/);
  });

  it("rejects non-positive or non-integer count options at the config boundary", () => {
    for (const options of [{ n: 0 }, { n: 1.5 }, { top: 0 }, { windowSize: -1 }]) {
      const parsed = parseYakeOptions(options);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.message).toMatch(/positive integer/);
    }
  });

  it("rejects invalid dedupLim values at the config boundary while keeping >=1 as the no-dedup mode", () => {
    for (const dedupLim of [-0.1, NaN, Infinity]) {
      const parsed = parseYakeOptions({ dedupLim });
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.message).toMatch(/dedupLim/);
    }

    const noDedup = parseYakeOptions({ dedupLim: 1.5 });
    expect(noDedup.ok).toBe(true);
  });
});
