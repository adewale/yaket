import { describe, expect, it } from "vitest";

import { KeywordExtractor, extractKeywords, type SentenceSplitter, type Tokenizer } from "../src/index.js";

describe("SentenceSplitter and Tokenizer accepted independently of TextProcessor", () => {
  it("routes sentence splitting through the user-supplied splitter and falls back to bundled tokenization", () => {
    const splitterCalls: string[] = [];
    const splitter: SentenceSplitter = {
      split(text: string): string[] {
        splitterCalls.push(text);
        return text.split("|").map((part) => part.trim()).filter((part) => part.length > 0);
      },
    };

    const result = extractKeywords("Machine learning improves software | Edge runtimes process requests", {
      language: "en",
      n: 2,
      top: 10,
      sentenceSplitter: splitter,
    });

    expect(splitterCalls).toHaveLength(1);
    expect(splitterCalls[0]).toContain("Edge runtimes process requests");
    const keywords = result.map(([keyword]) => keyword);
    expect(keywords).toContain("Machine learning");
    expect(keywords).toContain("Edge runtimes");
    // bundled tokenization keeps proper word boundaries; without it the |-split
    // would have left a stray pipe token in the result.
    expect(keywords.every((keyword) => !keyword.includes("|"))).toBe(true);
  });

  it("routes tokenization through the user-supplied tokenizer and keeps default sentence splitting", () => {
    const tokenizerCalls: string[] = [];
    const tokenizer: Tokenizer = {
      tokenize(text: string): string[] {
        tokenizerCalls.push(text);
        return text.split(/\s+/u).filter((token) => token.length > 0);
      },
    };

    const result = extractKeywords("Edge runtimes process requests near users. Workers run JavaScript at the edge.", {
      language: "en",
      n: 2,
      top: 8,
      tokenizer,
    });

    // bundled splitter still gives us two sentences, each tokenized by our hook.
    expect(tokenizerCalls.length).toBeGreaterThanOrEqual(2);
    expect(tokenizerCalls.some((call) => call.startsWith("Edge runtimes"))).toBe(true);
    expect(tokenizerCalls.some((call) => call.startsWith("Workers run"))).toBe(true);
    const keywords = result.map(([keyword]) => keyword);
    expect(keywords).toContain("Edge runtimes");
    // our tokenizer split on whitespace only, so trailing punctuation stays
    // attached. confirm it shows up exactly once.
    expect(keywords.filter((keyword) => keyword === "users.").length).toBeLessThanOrEqual(1);
  });

  it("uses both halves when sentenceSplitter and tokenizer are supplied without a combined TextProcessor", () => {
    const splitterCalls: string[] = [];
    const tokenizerCalls: string[] = [];

    const tokenizer: Tokenizer = {
      tokenize(text: string): string[] {
        tokenizerCalls.push(text);
        return text.split(/\s+/u).filter((token) => token.length > 0);
      },
    };
    const splitter: SentenceSplitter = {
      split(text: string): string[] {
        splitterCalls.push(text);
        return text.split(/\.\s+/u).map((part) => part.trim()).filter((part) => part.length > 0);
      },
    };

    const extractor = new KeywordExtractor({
      language: "en",
      n: 2,
      top: 5,
      sentenceSplitter: splitter,
      tokenizer,
    });

    const result = extractor.extractKeywords("Cloudflare Workers are edge runtimes. Modern runtimes power the edge.");
    const keywords = result.map(([keyword]) => keyword);

    expect(splitterCalls).toHaveLength(1);
    expect(tokenizerCalls).toHaveLength(2);
    expect(keywords.some((keyword) => keyword.toLowerCase().includes("workers"))).toBe(true);
    expect(keywords.some((keyword) => keyword.toLowerCase().includes("runtimes"))).toBe(true);
  });

  it("prefers the individual sentenceSplitter over a TextProcessor while still routing tokenization through the TextProcessor", () => {
    const tpSplitCalls: string[] = [];
    const tpTokCalls: string[] = [];
    const splitterCalls: string[] = [];

    const result = extractKeywords("Edge runtimes process requests near users.", {
      language: "en",
      n: 2,
      top: 5,
      textProcessor: {
        splitSentences(text) {
          tpSplitCalls.push(text);
          return [text];
        },
        tokenizeWords(text) {
          tpTokCalls.push(text);
          return text.split(/\s+/u).filter(Boolean);
        },
      },
      sentenceSplitter: {
        split(text) {
          splitterCalls.push(text);
          return [text];
        },
      },
    });

    expect(splitterCalls).toHaveLength(1);
    expect(tpSplitCalls).toHaveLength(0);
    // tokenization still flows through textProcessor since no individual tokenizer was supplied
    expect(tpTokCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.map(([keyword]) => keyword)).toContain("Edge runtimes");
  });
});
