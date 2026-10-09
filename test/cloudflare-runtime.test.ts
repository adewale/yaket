import { describe, expect, it } from "vitest";

import { extractFromDocument, extractKeywordDetails, extractKeywords, extractYakeKeywords, TextHighlighter } from "../src/index.js";

describe("cloudflare worker runtime", () => {
  it("runs the core APIs inside the Cloudflare worker pool", () => {
    const tuples = extractKeywords("Cloudflare Workers execute close to users.", { language: "en", n: 2, top: 5 });
    const details = extractKeywordDetails("Agent swarms coordinate work.", { language: "en", n: 2, top: 5 });
    const bobbin = extractYakeKeywords("Search enrichment depends on stable keywords.", 5, 2);
    const document = extractFromDocument({ id: "cf-doc", body: "Edge runtimes benefit from bundled assets.", language: "en" });
    const highlighted = new TextHighlighter().highlight("Machine learning improves software delivery.", [["machine learning", 0.1]]);

    expect(tuples[0]?.[0]).toBe("Cloudflare Workers");
    // V8 versions differ in the final few floating-point bits; the keyword
    // identity stays exact and the score stays within 5e-16 of the literal.
    expect(tuples[0]?.[1]).toBeCloseTo(0.023458380875189654, 15);
    expect(details[0]).toMatchObject({
      keyword: "Agent swarms",
      normalizedKeyword: "agent swarms",
      ngramSize: 2,
      occurrences: 1,
      sentenceIds: [0],
    });
    expect(bobbin[0]?.keyword).toBe("search enrichment");
    expect(bobbin[0]?.score).toBeCloseTo(0.049403840020656155, 15);
    expect(document.id).toBe("cf-doc");
    expect(document.keywords[0]).toMatchObject({
      keyword: "Edge runtimes benefit",
      normalizedKeyword: "edge runtimes benefit",
    });
    expect(highlighted).toBe("<mark>Machine learning</mark> improves software delivery.");
  });
});
