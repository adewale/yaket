import type { BobbinYakeResult } from "./bobbin.js";
import type { KeywordScore } from "./KeywordExtractor.js";
import type { KeywordResult } from "./strategies.js";

/**
 * Configuration for the text highlighter utility.
 */
export interface TextHighlighterOptions {
  maxNgramSize?: number;
  highlightPre?: string;
  highlightPost?: string;
}

type HighlightInput = string | KeywordScore | KeywordResult | BobbinYakeResult;

export class TextHighlighter {
  readonly maxNgramSize: number;
  readonly highlightPre: string;
  readonly highlightPost: string;

  /**
   * Creates a highlighter that wraps matched keywords in HTML markers.
   */
  constructor(options: TextHighlighterOptions = {}) {
    this.maxNgramSize = options.maxNgramSize ?? 3;
    this.highlightPre = options.highlightPre ?? "<mark>";
    this.highlightPost = options.highlightPost ?? "</mark>";
  }

  /**
   * Highlights keywords in the provided text.
   */
  highlight(text: string, keywords: Iterable<HighlightInput>): string {
    const matches: Array<{ start: number; end: number }> = [];

    for (const keyword of normalizeKeywords(keywords, this.maxNgramSize)) {
      const escaped = escapeRegExp(keyword);
      const pattern = new RegExp(`(^|[^\\p{L}\\p{Nd}])(${escaped})(?=$|[^\\p{L}\\p{Nd}])`, "giu");

      for (const match of text.matchAll(pattern)) {
        const fullMatch = match[0];
        const phrase = match[2];
        const start = (match.index ?? 0) + fullMatch.indexOf(phrase);
        const end = start + phrase.length;

        if (matches.some((existing) => rangesOverlap(existing.start, existing.end, start, end))) {
          continue;
        }

        matches.push({ start, end });
      }
    }

    if (matches.length === 0) {
      return text;
    }

    matches.sort((left, right) => left.start - right.start);

    let cursor = 0;
    let highlighted = "";
    for (const match of matches) {
      highlighted += text.slice(cursor, match.start);
      highlighted += `${this.highlightPre}${text.slice(match.start, match.end)}${this.highlightPost}`;
      cursor = match.end;
    }

    highlighted += text.slice(cursor);
    return highlighted;
  }
}

function normalizeKeywords(keywords: Iterable<HighlightInput>, maxNgramSize: number): string[] {
  return [...new Set([...keywords]
    .map((keyword) => toKeywordString(keyword).trim())
    .filter((keyword) => keyword.length > 0)
    .filter((keyword) => keyword.split(/\s+/).length <= maxNgramSize)
    .sort((left, right) => {
      const wordCountDiff = right.split(/\s+/).length - left.split(/\s+/).length;
      if (wordCountDiff !== 0) {
        return wordCountDiff;
      }

      return right.length - left.length;
    }))];
}

function toKeywordString(keyword: HighlightInput): string {
  if (typeof keyword === "string") {
    return keyword;
  }

  if (Array.isArray(keyword)) {
    return keyword[0];
  }

  return keyword.keyword;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}
