import { describe, expect, it } from "vitest";

import { getStopwordText, loadStopwords, supportedLanguages } from "../src/index.js";

describe("stopword exports", () => {
  it("does not expose the fallback sentinel as a language", () => {
    expect(supportedLanguages).not.toContain("noLang");
    expect(supportedLanguages).toContain("en");
  });

  it("loads known language stopwords as lowercase trimmed entries", () => {
    const english = loadStopwords("en");

    expect(english.has("the")).toBe(true);
    expect(english.has("and")).toBe(true);
    expect(english.has(" The ")).toBe(false);
  });

  it("falls back to the language-agnostic stopword list for unknown languages", () => {
    const unknown = getStopwordText("zz");
    const unknownRegional = getStopwordText("zz-ZZ");
    const loaded = loadStopwords("zz-ZZ");

    expect(unknown).toBe(unknownRegional);
    expect(unknown).toBe("");
    expect(loaded).toEqual(new Set());
  });
});
