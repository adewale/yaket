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
  const ranked = extractKeywordDetails(text, {
    lan: "en",
    top: Math.max(n * 3, n),
    n: maxNgram,
  }).map(({ keyword, score }) => ({
    keyword: keyword.toLowerCase(),
    score,
  }));

  const results: BobbinYakeResult[] = [];
  for (const candidate of ranked) {
    if (candidate.keyword.split(/\s+/).length === 1) {
      const unigram = candidate.keyword;
      if (results.some((item) => item.keyword.includes(" ") && item.keyword.split(/\s+/).includes(unigram))) {
        continue;
      }
    }

    results.push(candidate);
    if (results.length === n) {
      break;
    }
  }

  return results;
}
