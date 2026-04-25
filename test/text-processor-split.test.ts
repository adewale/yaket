import { describe, expect, it } from "vitest";

import { KeywordExtractor, extractKeywords, type SentenceSplitter, type Tokenizer } from "../src/index.js";

describe("SentenceSplitter and Tokenizer accepted independently of TextProcessor", () => {
  it("accepts only a sentenceSplitter override and uses default tokenization", () => {
    const calls: string[] = [];
    const splitter: SentenceSplitter = {
      split(text: string): string[] {
        calls.push(text);
        return text.split("|").map((part) => part.trim()).filter((part) => part.length > 0);
      },
    };

    const result = extractKeywords("Machine learning improves software | Edge runtimes process requests", {
      language: "en",
      n: 2,
      top: 5,
      sentenceSplitter: splitter,
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(result.length).toBeGreaterThan(0);
    expect(result.map(([keyword]) => keyword)).toContain("Machine learning");
  });

  it("accepts only a tokenizer override and uses default sentence splitting", () => {
    const calls: string[] = [];
    const tokenizer: Tokenizer = {
      tokenize(text: string): string[] {
        calls.push(text);
        return text.split(/\s+/u).filter((token) => token.length > 0);
      },
    };

    const result = extractKeywords("Edge runtimes process requests near users.", {
      language: "en",
      n: 2,
      top: 5,
      tokenizer,
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(result.length).toBeGreaterThan(0);
    expect(result.map(([keyword]) => keyword)).toContain("Edge runtimes");
  });

  it("lets sentenceSplitter and tokenizer be used together without a combined TextProcessor", () => {
    const tokenizer: Tokenizer = {
      tokenize(text: string): string[] {
        return text.split(/\s+/u).filter((token) => token.length > 0);
      },
    };
    const splitter: SentenceSplitter = {
      split(text: string): string[] {
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
    expect(result.length).toBeGreaterThan(0);
  });

  it("prefers individual sentenceSplitter/tokenizer overrides over a TextProcessor when both are supplied", () => {
    const tpCalls: string[] = [];
    const splitterCalls: string[] = [];

    const result = extractKeywords("Edge runtimes process requests near users.", {
      language: "en",
      n: 2,
      top: 5,
      textProcessor: {
        splitSentences(text) {
          tpCalls.push(`tp:split:${text}`);
          return [text];
        },
        tokenizeWords(text) {
          tpCalls.push(`tp:tok:${text}`);
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

    expect(splitterCalls.length).toBeGreaterThan(0);
    // tokenization still flows through textProcessor since no individual tokenizer was supplied
    expect(tpCalls.some((entry) => entry.startsWith("tp:tok:"))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
