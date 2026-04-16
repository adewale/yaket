import { extractKeywordDetails } from "./KeywordExtractor.js";

/**
 * Result shape expected by Bobbin's YAKE-compatible adapter layer.
 */
export interface BobbinYakeResult {
  keyword: string;
  score: number;
}

/**
 * Compatibility wrapper for Bobbin's existing YAKE-like service API.
 */
export function extractYakeKeywords(
  text: string,
  n = 5,
  maxNgram = 3,
): BobbinYakeResult[] {
  return extractKeywordDetails(text, {
    lan: "en",
    top: n,
    n: maxNgram,
  }).map(({ keyword, score }) => ({
    keyword: keyword.toLowerCase(),
    score,
  }));
}
