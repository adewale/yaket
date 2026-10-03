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
import { helpText, parseCliArgs } from "../src/cli.js";

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
    const extractorOutput = extractor.extractKeywords("Cloudflare Workers are edge runtimes.");
    expect(extractorOutput.length).toBeGreaterThanOrEqual(2);
    expect(extractorOutput.length).toBeLessThanOrEqual(5);
    expect(extractorOutput.map(([keyword]) => keyword)).toContain("Cloudflare Workers");
    expect(extracted).toEqual(tuples);
    expect(tuples.map(([keyword]) => keyword)).toContain("Machine learning");
    expect(details.map((entry) => entry.normalizedKeyword)).toContain("search indexing");
    expect(details.every((entry) => entry.score > 0 && Number.isFinite(entry.score))).toBe(true);
    expect(details.every((entry) => entry.normalizedKeyword === entry.normalizedKeyword.toLowerCase())).toBe(true);
    expect(bobbin.map((entry) => entry.keyword)).toContain("platform ecosystems");
    expect(bobbin.every((entry) => entry.keyword === entry.keyword.toLowerCase())).toBe(true);
    expect(document.id).toBe("doc");
    expect(document.language).toBe("en");
    expect(document.keywords.map((entry) => entry.normalizedKeyword)).toContain("document pipelines");
    // Highlighter wraps any matched keyword token. Confirm it covers the
    // top-ranked phrases rather than asserting a specific phrase boundary
    // (which depends on dedup and ranking ties).
    expect(highlighted).toMatch(/<mark>[^<]*Machine[^<]*<\/mark>/);
    expect(highlighted).toMatch(/<mark>[^<]*learning[^<]*<\/mark>/);
    expect(derivedStopwords.has("yaket")).toBe(true);
    expect(derivedStopwords.has("the")).toBe(true);
    expect(provider.load("en")).toEqual(new Set(["alpha", "beta"]));
    expect(STOPWORDS["en"]).toContain("the");
    expect(STOPWORDS["en"]).toContain("a");
  });

  it("keeps documented exports and CLI flags in sync", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      bin: Record<string, string>;
    };

    expect(Object.keys(packageJson.exports)).toEqual(expect.arrayContaining([".", "./browser", "./worker"]));
    expect(packageJson.bin["yaket"]).toBe("dist/cli.js");

    // The README's CLI flag list and `yaket --help` document the same flags,
    // and the parser accepts each one (a flag the parser ignores leaves the
    // parse identical to an empty argv).
    const helpFlags = [...helpText().matchAll(/--[a-z][a-z-]*/g)].map(([flag]) => flag);
    const readmeFlags = [...readme.matchAll(/^- `(--[a-z][a-z-]*)`$/gm)].map(([, flag]) => flag!);
    // Lower bound: the options of upstream YAKE's CLI that Yaket mirrors.
    expect(helpFlags).toEqual(expect.arrayContaining(["--text-input", "--input-file", "--language", "--ngram-size", "--dedup-func", "--dedup-lim", "--window-size", "--top", "--verbose", "--help"]));
    expect([...readmeFlags].sort()).toEqual([...helpFlags].sort());

    const emptyParse = parseCliArgs([]);
    for (const flag of helpFlags) {
      expect(parseCliArgs([flag, "2"]), `CLI parser ignores documented flag ${flag}`).not.toEqual(emptyParse);
    }

    for (const token of ["TextProcessor", "StopwordProvider", "SimilarityStrategy", "CandidateNormalizer", "Lemmatizer", "SingleWordScorer", "MultiWordScorer", "KeywordScorer", "candidateFilter", "supportedLanguages", "STOPWORDS", "YakeResult", "YakeOptions", "extract(", "createStopwordSet", "createStaticStopwordProvider"]) {
      expect(readme).toContain(token);
    }
  });
});
