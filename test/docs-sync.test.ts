import { describe, expect, it } from "vitest";

import {
  KeywordExtractor,
  TextHighlighter,
  createKeywordExtractor,
  extractFromDocument,
  extractKeywordDetails,
  extractKeywords,
  extractYakeKeywords,
} from "../src/index.js";

describe("documentation-code sync", () => {
  it("supports the APIs documented in the README and integration guides", () => {
    const extractor = new KeywordExtractor({ lan: "en", n: 2, top: 5 });
    const created = createKeywordExtractor({ lan: "en", n: 2, top: 5 });
    const tuples = extractKeywords("Machine learning improves software delivery.", { lan: "en", n: 2, top: 5 });
    const details = extractKeywordDetails("Search indexing helps relevance.", { lan: "en", n: 2, top: 5 });
    const bobbin = extractYakeKeywords("Platform ecosystems reward integration.", 5, 2);
    const document = extractFromDocument({ id: "doc", body: "Document pipelines need stable keyword extraction.", language: "en" });
    const highlighted = new TextHighlighter().highlight("Machine learning improves software delivery.", tuples);

    expect(created).toBeInstanceOf(KeywordExtractor);
    expect(extractor.extractKeywords("Cloudflare Workers are edge runtimes.").length).toBeGreaterThan(0);
    expect(tuples.length).toBeGreaterThan(0);
    expect(details.length).toBeGreaterThan(0);
    expect(bobbin.length).toBeGreaterThan(0);
    expect(document.keywords.length).toBeGreaterThan(0);
    expect(highlighted).toContain("<mark>");
  });
});
