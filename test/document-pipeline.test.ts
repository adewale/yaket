import { describe, expect, it } from "vitest";

import { estimateSerializedBytes, extractFromDocument, extractFromDocuments, extractFromDocumentStream, serializeDocumentKeywordResult, serializeDocumentKeywordResults } from "../src/index.js";

describe("document pipeline helpers", () => {
  it("extracts keyword details from a single document", () => {
    const result = extractFromDocument({
      id: "doc-1",
      language: "en",
      title: "Machine Learning Notes",
      body: "Machine learning systems improve software delivery.",
      metadata: { source: "test" },
    });

    expect(result.id).toBe("doc-1");
    expect(result.language).toBe("en");
    expect(result.title).toBe("Machine Learning Notes");
    expect(result.metadata).toEqual({ source: "test" });
    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.keywords[0]).toHaveProperty("normalizedKeyword");
    expect(result.keywords[0]).toHaveProperty("ngramSize");
  });

  it("extracts multiple documents deterministically", () => {
    const documents = [
      { id: "a", body: "Platforms shape ecosystems.", language: "en" },
      { id: "b", body: "Search systems depend on good indexing.", language: "en" },
    ];

    const first = extractFromDocuments(documents, { top: 3 });
    const second = extractFromDocuments(documents, { top: 3 });

    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
    expect(first[0]!.id).toBe("a");
    expect(first[1]!.id).toBe("b");
  });

  it("supports async iterable document streams", async () => {
    async function* documents() {
      yield { id: "stream-1", body: "Distributed systems coordinate peers.", language: "en" };
      yield { id: "stream-2", body: "Compilers transform source programs.", language: "en" };
    }

    const results: string[] = [];
    for await (const item of extractFromDocumentStream(documents(), { top: 2 })) {
      results.push(item.id);
      expect(item.keywords.length).toBeLessThanOrEqual(2);
    }

    expect(results).toEqual(["stream-1", "stream-2"]);
  });

  it("does not create cross-boundary title-body phrases when including the title", () => {
    const result = extractFromDocument({
      id: "doc-boundary",
      title: "Cloudflare Workers",
      body: "Search indexing improves relevance.",
      language: "en",
    }, { top: 10, n: 2, includeTitleInText: true });

    expect(result.keywords.some((item) => item.normalizedKeyword === "workers search")).toBe(false);
  });

  it("supports includeTitleInText=false and language option precedence", () => {
    const result = extractFromDocument({
      id: "doc-no-title",
      title: "Cloudflare Workers",
      body: "Search indexing improves relevance.",
      language: "pt",
    }, { includeTitleInText: false, language: "en", top: 5, n: 2 });

    expect(result.language).toBe("en");
    expect(result.keywords.some((item) => item.keyword.includes("Cloudflare"))).toBe(false);
  });

  it("supports document text and keyword post-processing hooks", () => {
    const result = extractFromDocument({
      id: "doc-hooks",
      title: "Cloudflare Workers",
      body: "Search indexing improves relevance.",
      language: "en",
    }, {
      top: 10,
      n: 2,
      beforeExtractText(text) {
        return `${text}\n\nEdge runtime diagnostics improve visibility.`;
      },
      afterExtractKeywords(keywords) {
        return keywords.filter((item) => item.ngramSize === 2);
      },
    });

    expect(result.keywords.every((item) => item.ngramSize === 2)).toBe(true);
    expect(result.keywords.some((item) => item.normalizedKeyword.includes("runtime"))).toBe(true);
  });

  it("serializes document keyword results deterministically", () => {
    const first = extractFromDocument({
      id: "stable",
      body: "Search indexing improves relevance.",
      language: "en",
      metadata: { b: 2, a: 1 },
    }, { top: 3, n: 2 });
    const second = extractFromDocument({
      id: "stable",
      body: "Search indexing improves relevance.",
      language: "en",
      metadata: { a: 1, b: 2 },
    }, { top: 3, n: 2 });

    const firstSerialized = serializeDocumentKeywordResult(first);
    const secondSerialized = serializeDocumentKeywordResult(second);

    expect(firstSerialized).toBe(secondSerialized);
    expect(serializeDocumentKeywordResults([first])).toBe(`[${firstSerialized}]`);
    expect(estimateSerializedBytes(first)).toBeGreaterThan(0);
  });
});
