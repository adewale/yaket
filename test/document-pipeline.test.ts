import { describe, expect, it } from "vitest";

import { extractFromDocument, extractFromDocuments, extractFromDocumentStream } from "../src/index.js";

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
});
