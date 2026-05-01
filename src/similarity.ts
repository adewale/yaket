const DEFAULT_MAX_CACHE_SIZE = 20_000;
const CACHE_KEY_SEPARATOR = "\u0000";

export interface SimilarityCacheStats {
  distance: number;
  ratio: number;
  sequence: number;
  jaro: number;
}

/**
 * Pluggable cache surface used by the similarity helpers.
 *
 * Each instance owns four bounded `Map`s — one per similarity helper.
 * Pass an instance to a similarity function (or to `KeywordExtractor` via
 * `similarityCache`) to keep cache state isolated from the module-level
 * default and bounded to a smaller `maxSize` if needed.
 */
export interface SimilarityCache {
  readonly distance: Map<string, number>;
  readonly ratio: Map<string, number>;
  readonly sequence: Map<string, number>;
  readonly jaro: Map<string, number>;
  readonly maxSize: number;
  stats(): SimilarityCacheStats;
  clear(): void;
}

/**
 * Creates an isolated similarity cache bounded by `maxSize` (default 20000).
 *
 * Useful for long-running workers that want bounded per-request caches, for
 * tests that need to avoid leaking state into the module-level default, and
 * for benchmarks that need a reset between runs without disturbing other
 * callers.
 */
export function createSimilarityCache(options: { maxSize?: number } = {}): SimilarityCache {
  const maxSize = options.maxSize ?? DEFAULT_MAX_CACHE_SIZE;
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new RangeError(`createSimilarityCache: maxSize must be a positive integer, got ${String(options.maxSize)}`);
  }
  const cache: SimilarityCache = {
    distance: new Map<string, number>(),
    ratio: new Map<string, number>(),
    sequence: new Map<string, number>(),
    jaro: new Map<string, number>(),
    maxSize,
    stats(): SimilarityCacheStats {
      return {
        distance: cache.distance.size,
        ratio: cache.ratio.size,
        sequence: cache.sequence.size,
        jaro: cache.jaro.size,
      };
    },
    clear(): void {
      cache.distance.clear();
      cache.ratio.clear();
      cache.sequence.clear();
      cache.jaro.clear();
    },
  };

  return cache;
}

const defaultCache = createSimilarityCache();

export class Levenshtein {
  /**
   * Returns a normalized Levenshtein similarity ratio.
   */
  static ratio(seq1: string, seq2: string, cache: SimilarityCache = defaultCache): number {
    const key = cacheKey(seq1, seq2);
    const cached = cache.ratio.get(key);
    if (cached != null) {
      return cached;
    }

    const distance = Levenshtein.distance(seq1, seq2, cache);
    const length = Math.max(seq1.length, seq2.length);
    const ratio = length > 0 ? 1 - distance / length : 1;

    setBoundedCache(cache.ratio, key, ratio, cache.maxSize);
    return ratio;
  }

  /**
   * Returns the exact Levenshtein edit distance.
   */
  static distance(seq1: string, seq2: string, cache: SimilarityCache = defaultCache): number {
    const key = cacheKey(seq1, seq2);
    const cached = cache.distance.get(key);
    if (cached != null) {
      return cached;
    }

    let len1 = seq1.length;
    const len2 = seq2.length;

    if (len1 === 0) {
      setBoundedCache(cache.distance, key, len2, cache.maxSize);
      return len2;
    }

    if (len2 === 0) {
      setBoundedCache(cache.distance, key, len1, cache.maxSize);
      return len1;
    }

    if (len1 > len2) {
      [seq1, seq2] = [seq2, seq1];
      len1 = seq1.length;
    }

    const result = len1 <= 3 ? simpleDistance(seq1, seq2) : matrixDistance(seq1, seq2);
    setBoundedCache(cache.distance, key, result, cache.maxSize);
    return result;
  }
}

/**
 * Normalized Levenshtein similarity helper for deduplication.
 */
export function levenshteinSimilarity(cand1: string, cand2: string, cache: SimilarityCache = defaultCache): number {
  const cand1Chars = [...cand1];
  const cand2Chars = [...cand2];
  const maxLength = Math.max(cand1Chars.length, cand2Chars.length);
  if (maxLength === 0) {
    return 1;
  }

  return 1 - (Levenshtein.distance(cand1, cand2, cache) / maxLength);
}

/**
 * Sequence-style similarity used to approximate upstream YAKE's `seqm` dedup behavior.
 */
export function sequenceSimilarity(cand1: string, cand2: string, cache: SimilarityCache = defaultCache): number {
  const key = cacheKey(cand1, cand2);
  const cached = cache.sequence.get(key);
  if (cached != null) {
    return cached;
  }

  if (cand1 === cand2) {
    setBoundedCache(cache.sequence, key, 1, cache.maxSize);
    return 1;
  }

  if (!aggressivePreFilter(cand1, cand2)) {
    setBoundedCache(cache.sequence, key, 0, cache.maxSize);
    return 0;
  }

  const cand1Chars = [...cand1];
  const cand2Chars = [...cand2];
  const maxLength = Math.max(cand1Chars.length, cand2Chars.length);
  const lengthRatio = Math.min(cand1Chars.length, cand2Chars.length) / maxLength;
  if (lengthRatio < 0.3) {
    setBoundedCache(cache.sequence, key, 0, cache.maxSize);
    return 0;
  }

  const s1 = cand1.toLowerCase();
  const s2 = cand2.toLowerCase();
  const charUnion = new Set([...s1, ...s2]);
  const overlap = [...new Set(s1)].filter((char) => s2.includes(char)).length / charUnion.size;
  if (overlap < 0.2) {
    setBoundedCache(cache.sequence, key, 0, cache.maxSize);
    return 0;
  }

  if (maxLength <= 4) {
    const result = overlap * lengthRatio;
    setBoundedCache(cache.sequence, key, result, cache.maxSize);
    return result;
  }

  const words1 = s1.split(/\s+/).filter(Boolean);
  const words2 = s2.split(/\s+/).filter(Boolean);
  if (words1.length > 1 || words2.length > 1) {
    const wordUnion = new Set([...words1, ...words2]);
    if (wordUnion.size > 0) {
      const wordOverlap = [...new Set(words1)].filter((word) => words2.includes(word)).length / wordUnion.size;
      if (wordOverlap > 0.4) {
        setBoundedCache(cache.sequence, key, wordOverlap, cache.maxSize);
        return wordOverlap;
      }
    }
  }

  const trigrams1 = trigrams([...s1]);
  const trigrams2 = trigrams([...s2]);
  const trigramUnion = new Set([...trigrams1, ...trigrams2]);
  const trigramOverlap = trigramUnion.size === 0 ? 0 : [...trigrams1].filter((trigram) => trigrams2.has(trigram)).length / trigramUnion.size;
  const result = Math.min((0.3 * lengthRatio) + (0.2 * overlap) + (0.5 * trigramOverlap), 1);

  setBoundedCache(cache.sequence, key, result, cache.maxSize);
  return result;
}

/**
 * Jaro similarity helper.
 *
 * Memoized in the supplied `SimilarityCache`. Without an explicit cache
 * argument, the module-level default cache is used, mirroring the other
 * helpers.
 */
export function jaroSimilarity(first: string, second: string, cache: SimilarityCache = defaultCache): number {
  const key = cacheKey(first, second);
  const cached = cache.jaro.get(key);
  if (cached != null) {
    return cached;
  }

  const result = computeJaro(first, second);
  setBoundedCache(cache.jaro, key, result, cache.maxSize);
  return result;
}

function computeJaro(first: string, second: string): number {
  if (first === second) {
    return 1;
  }

  const firstLength = first.length;
  const secondLength = second.length;
  if (firstLength === 0 || secondLength === 0) {
    return 0;
  }

  const matchDistance = Math.max(Math.floor(Math.max(firstLength, secondLength) / 2) - 1, 0);
  const firstMatches = new Array<boolean>(firstLength).fill(false);
  const secondMatches = new Array<boolean>(secondLength).fill(false);

  let matches = 0;
  for (let index = 0; index < firstLength; index += 1) {
    const start = Math.max(0, index - matchDistance);
    const end = Math.min(index + matchDistance + 1, secondLength);

    for (let candidate = start; candidate < end; candidate += 1) {
      if (secondMatches[candidate] || first[index] !== second[candidate]) {
        continue;
      }

      firstMatches[index] = true;
      secondMatches[candidate] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) {
    return 0;
  }

  let transpositions = 0;
  let secondIndex = 0;
  for (let index = 0; index < firstLength; index += 1) {
    if (!firstMatches[index]) {
      continue;
    }

    while (!secondMatches[secondIndex]) {
      secondIndex += 1;
    }

    if (first[index] !== second[secondIndex]) {
      transpositions += 1;
    }

    secondIndex += 1;
  }

  const transpositionCount = transpositions / 2;
  return ((matches / firstLength) + (matches / secondLength) + ((matches - transpositionCount) / matches)) / 3;
}

function cacheKey(first: string, second: string): string {
  return first <= second ? `${first}${CACHE_KEY_SEPARATOR}${second}` : `${second}${CACHE_KEY_SEPARATOR}${first}`;
}

function simpleDistance(seq1: string, seq2: string): number {
  if (seq1.length === 0) {
    return seq2.length;
  }

  if (seq2.length === 0) {
    return seq1.length;
  }

  if (seq1[0] === seq2[0]) {
    return simpleDistance(seq1.slice(1), seq2.slice(1));
  }

  return 1 + Math.min(simpleDistance(seq1.slice(1), seq2), simpleDistance(seq1, seq2.slice(1)), simpleDistance(seq1.slice(1), seq2.slice(1)));
}

function matrixDistance(seq1: string, seq2: string): number {
  const previousRow = Array.from({ length: seq2.length + 1 }, (_, index) => index);
  const currentRow = new Array<number>(seq2.length + 1).fill(0);

  for (let i = 1; i <= seq1.length; i += 1) {
    currentRow[0] = i;

    for (let j = 1; j <= seq2.length; j += 1) {
      const cost = seq1[i - 1] === seq2[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(currentRow[j - 1]! + 1, previousRow[j]! + 1, previousRow[j - 1]! + cost);
    }

    for (let j = 0; j < previousRow.length; j += 1) {
      previousRow[j] = currentRow[j]!;
    }
  }

  return previousRow[seq2.length]!;
}

/** @internal */
export function trigrams(chars: string[]): Set<string> {
  const result = new Set<string>();

  for (let index = 0; index <= chars.length - 3; index += 1) {
    result.add(chars.slice(index, index + 3).join(""));
  }

  return result;
}

/** @internal */
export function aggressivePreFilter(cand1: string, cand2: string): boolean {
  if (cand1 === cand2) {
    return true;
  }

  const chars1 = [...cand1];
  const chars2 = [...cand2];
  const len1 = chars1.length;
  const len2 = chars2.length;
  const maxLength = Math.max(len1, len2);

  if (Math.abs(len1 - len2) > maxLength * 0.6) {
    return false;
  }

  if (maxLength > 3) {
    if (chars1[0] !== chars2[0] || chars1[len1 - 1] !== chars2[len2 - 1]) {
      return false;
    }

    if (Math.min(len1, len2) >= 3 && chars1.slice(0, 2).join("").toLowerCase() !== chars2.slice(0, 2).join("").toLowerCase()) {
      return false;
    }
  }

  if (Math.abs(countSpaces(cand1) - countSpaces(cand2)) > 1) {
    return false;
  }

  return true;
}

/** @internal */
export function countSpaces(value: string): number {
  let count = 0;
  for (const char of value) {
    if (char === " ") {
      count += 1;
    }
  }
  return count;
}

function setBoundedCache(cache: Map<string, number>, key: string, value: number, maxSize: number): void {
  if (!cache.has(key) && cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey != null) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, value);
}

/**
 * Returns current sizes of the module-level bounded similarity caches.
 *
 * Custom caches created via `createSimilarityCache()` expose the same
 * information through their own `.stats()` method.
 */
export function getSimilarityCacheStats(): SimilarityCacheStats {
  return defaultCache.stats();
}

/**
 * Clears the module-level bounded similarity caches.
 *
 * Custom caches created via `createSimilarityCache()` expose `.clear()` for
 * the equivalent operation on isolated state.
 */
export function clearSimilarityCaches(): void {
  defaultCache.clear();
}
