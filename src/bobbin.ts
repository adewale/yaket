import { extractKeywordDetails } from "./KeywordExtractor.js";

export interface BobbinYakeResult {
  keyword: string;
  score: number;
}

/**
 * Compatibility wrapper for Bobbin's existing YAKE-like service API.
 *
 * - `n` maps to result count (`top`)
 * - `maxNgram` maps to YAKE maximum candidate size (`n`)
 * - keywords are normalized to lowercase to match Bobbin's current shape
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
