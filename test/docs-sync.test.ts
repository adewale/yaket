import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  KeywordExtractor,
  STOPWORDS,
  TextHighlighter,
  createKeywordExtractor,
  createStaticStopwordProvider,
  createStopwordSet,
  extract,
  extractFromDocument,
  extractKeywordDetails,
  extractKeywords,
  extractYakeKeywords,
} from "../src/index.js";

describe("documentation-code sync", () => {
  it("supports the APIs documented in the README and integration guides", () => {
    const extractor = new KeywordExtractor({ language: "en", n: 2, top: 5 });
    const created = createKeywordExtractor({ language: "en", n: 2, top: 5 });
    const extracted = extract("Machine learning improves software delivery.", { language: "en", n: 2, top: 5 });
    const tuples = extractKeywords("Machine learning improves software delivery.", { language: "en", n: 2, top: 5 });
    const details = extractKeywordDetails("Search indexing helps relevance.", { language: "en", n: 2, top: 5 });
    const bobbin = extractYakeKeywords("Platform ecosystems reward integration.", 5, 2);
    const document = extractFromDocument({ id: "doc", body: "Document pipelines need stable keyword extraction.", language: "en" });
    const highlighted = new TextHighlighter().highlight("Machine learning improves software delivery.", tuples);
    const derivedStopwords = createStopwordSet("en", { add: ["yaket"] });
    const provider = createStaticStopwordProvider({ en: ["alpha", "beta"] });

    expect(created).toBeInstanceOf(KeywordExtractor);
    expect(extractor.extractKeywords("Cloudflare Workers are edge runtimes.").length).toBeGreaterThan(0);
    expect(extracted).toEqual(tuples);
    expect(tuples.length).toBeGreaterThan(0);
    expect(details.length).toBeGreaterThan(0);
    expect(bobbin.length).toBeGreaterThan(0);
    expect(document.keywords.length).toBeGreaterThan(0);
    expect(highlighted).toContain("<mark>");
    expect(derivedStopwords.has("yaket")).toBe(true);
    expect(provider.load("en")).toEqual(new Set(["alpha", "beta"]));
    expect(STOPWORDS.en).toContain("the");
  });

  it("keeps documented exports and CLI flags in sync", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      bin: Record<string, string>;
    };
    const cliSource = readFileSync(join(process.cwd(), "src/cli.ts"), "utf8");

    expect(Object.keys(packageJson.exports)).toEqual(expect.arrayContaining([".", "./browser", "./worker"]));
    expect(packageJson.bin.yaket).toBe("dist/cli.js");

    for (const flag of ["--text-input", "--input-file", "--language", "--ngram-size", "--dedup-func", "--dedup-lim", "--window-size", "--top", "--verbose", "--help"]) {
      expect(cliSource).toContain(flag);
      expect(readme).toContain(flag);
    }

    for (const token of ["TextProcessor", "StopwordProvider", "SimilarityStrategy", "CandidateNormalizer", "Lemmatizer", "SingleWordScorer", "MultiWordScorer", "KeywordScorer", "candidateFilter", "supportedLanguages", "STOPWORDS", "YakeResult", "YakeOptions", "extract(", "createStopwordSet", "createStaticStopwordProvider"]) {
      expect(readme).toContain(token);
    }
  });
});
