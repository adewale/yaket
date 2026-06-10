import type { KeywordResult, Lemmatizer } from "./strategies.js";

export const LEMMA_AGGREGATION_NAMES = ["min", "mean", "max", "harmonic"] as const;

export type LemmaAggregationName = typeof LEMMA_AGGREGATION_NAMES[number];

const LEMMA_AGGREGATION_NAME_SET = new Set<string>(LEMMA_AGGREGATION_NAMES);

export function isLemmaAggregationName(value: string): value is LemmaAggregationName {
  return LEMMA_AGGREGATION_NAME_SET.has(value);
}

/**
 * Groups ranked keywords by their lemmatized form and combines each group's
 * scores with the requested policy, mirroring upstream Python YAKE's
 * `lemma_aggregation` behavior:
 *
 * - `min`      keeps the best-scoring (lowest) variant and its score
 * - `mean`     keeps the first (best-ranked) variant with the arithmetic mean
 * - `max`      keeps the worst-scoring (highest) variant and its score
 * - `harmonic` keeps the first variant with the harmonic mean when every
 *              score is positive, otherwise the arithmetic mean
 *
 * Like upstream, this runs on the final ranked list (post-dedup, post-top),
 * so the output can be shorter than the input. The result is re-sorted
 * ascending by score; ties keep first-seen lemma order.
 */
export function aggregateKeywordsByLemma(
  results: readonly KeywordResult[],
  lemmatizer: Lemmatizer,
  language: string,
  policy: LemmaAggregationName,
): KeywordResult[] {
  if (results.length === 0) {
    return [];
  }

  const groups = new Map<string, KeywordResult[]>();
  for (const result of results) {
    const lemma = lemmatizeKeyword(result.normalizedKeyword, lemmatizer, language);
    const group = groups.get(lemma);
    if (group == null) {
      groups.set(lemma, [result]);
    } else {
      group.push(result);
    }
  }

  const aggregated: KeywordResult[] = [];
  for (const group of groups.values()) {
    aggregated.push(aggregateGroup(group, policy));
  }

  // Stable ascending re-sort: ties keep first-seen lemma order, matching
  // upstream's `sorted(result, key=lambda x: x[1])` over dict insertion order.
  return aggregated.sort((left, right) => left.score - right.score);
}

function lemmatizeKeyword(normalizedKeyword: string, lemmatizer: Lemmatizer, language: string): string {
  return normalizedKeyword
    .split(/\s+/u)
    .map((token) => lemmatizer.lemmatize(token, { original: token, language }).toLowerCase())
    .join(" ");
}

function aggregateGroup(group: readonly KeywordResult[], policy: LemmaAggregationName): KeywordResult {
  switch (policy) {
    case "min": {
      return group.reduce((best, entry) => (entry.score < best.score ? entry : best));
    }
    case "max": {
      return group.reduce((worst, entry) => (entry.score > worst.score ? entry : worst));
    }
    case "mean": {
      return { ...group[0]!, score: arithmeticMean(group) };
    }
    case "harmonic": {
      const score = group.every((entry) => entry.score > 0)
        ? group.length / group.reduce((sum, entry) => sum + 1 / entry.score, 0)
        : arithmeticMean(group);
      return { ...group[0]!, score };
    }
  }
}

function arithmeticMean(group: readonly KeywordResult[]): number {
  return group.reduce((sum, entry) => sum + entry.score, 0) / group.length;
}
