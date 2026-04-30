import { describe, expect, it } from "vitest";

import { ComposedWord, DataCore } from "../src/index.js";

describe("candidate construction", () => {
  it("does not represent missing document terms as an empty sentinel candidate", () => {
    const core = new DataCore("alpha beta", new Set());

    expect(core.tryBuildCandidate("gamma")).toBeNull();
    expect(() => core.buildCandidate("gamma")).toThrow(/no terms/);
  });

  it("builds valid candidates only when at least one term exists in the document", () => {
    const core = new DataCore("alpha beta", new Set());
    const candidate = core.buildCandidate("alpha gamma");

    expect(candidate.kw).toBe("alpha gamma");
    expect(candidate.uniqueKw).toBe("alpha gamma");
    expect(candidate.terms.map((term) => term.uniqueTerm)).toEqual(["alpha"]);
  });

  it("rejects direct empty ComposedWord construction", () => {
    expect(() => new ComposedWord([])).toThrow(/at least one/);
  });

  it("preserves candidate insertion order for sliding n-grams", () => {
    const core = new DataCore("alpha beta gamma", new Set(), { n: 3, windowSize: 1 });

    expect([...core.candidates.keys()]).toEqual([
      "alpha",
      "beta",
      "alpha beta",
      "gamma",
      "beta gamma",
      "alpha beta gamma",
    ]);
  });
});
