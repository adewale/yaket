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

  it("rejects unknown dedup functions at the config boundary", () => {
    const parsed = parseYakeOptions({ dedupFunc: "sequencematcher" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.message).toMatch(/sequencematcher/);
    expect(parsed.error.message).toMatch(/seqm/);
  });
});
