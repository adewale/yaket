import { describe, expect, it } from "vitest";

import { STOPWORDS, bundledStopwordTexts, createStaticStopwordProvider, createStopwordSet, getStopwordText, loadStopwords, supportedLanguages } from "../src/index.js";

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

  it("exposes bundled stopword text for extension use cases", () => {
    expect(bundledStopwordTexts.en).toContain("the");
    expect(STOPWORDS.en).toBe(bundledStopwordTexts.en);
    expect(Object.isFrozen(bundledStopwordTexts)).toBe(true);
  });

  it("creates derived stopword sets with add/remove/replace options", () => {
    const extended = createStopwordSet("en", { add: ["yaket"], remove: ["the"] });
    const replaced = createStopwordSet("en", { replace: ["alpha", "beta"] });

    expect(extended.has("yaket")).toBe(true);
    expect(extended.has("the")).toBe(false);
    expect(replaced).toEqual(new Set(["alpha", "beta"]));
  });

  it("creates static stopword providers from user-supplied maps", () => {
    const provider = createStaticStopwordProvider({
      en: ["alpha", "beta"],
      pt: "um\numa",
    });

    expect(provider.load("en")).toEqual(new Set(["alpha", "beta"]));
    expect(provider.load("pt-BR")).toEqual(new Set(["um", "uma"]));
    expect(provider.load("zz")).toEqual(new Set());
  });
});
