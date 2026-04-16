import { describe, expect, it } from "vitest";

import { extractFromDocument, extractKeywordDetails, extractKeywords, extractYakeKeywords, TextHighlighter } from "../src/index.js";

describe("cloudflare worker runtime", () => {
  it("runs the core APIs inside the Cloudflare worker pool", () => {
    const tuples = extractKeywords("Cloudflare Workers execute close to users.", { lan: "en", n: 2, top: 5 });
    const details = extractKeywordDetails("Agent swarms coordinate work.", { lan: "en", n: 2, top: 5 });
    const bobbin = extractYakeKeywords("Search enrichment depends on stable keywords.", 5, 2);
    const document = extractFromDocument({ id: "cf-doc", body: "Edge runtimes benefit from bundled assets.", language: "en" });
    const highlighted = new TextHighlighter().highlight("Machine learning improves software delivery.", [["machine learning", 0.1]]);

    expect(tuples.length).toBeGreaterThan(0);
    expect(details.length).toBeGreaterThan(0);
    expect(bobbin.length).toBeGreaterThan(0);
    expect(document.id).toBe("cf-doc");
    expect(highlighted).toContain("<mark>");
  });
});
