const distanceCache = new Map<string, number>();
const ratioCache = new Map<string, number>();
const sequenceCache = new Map<string, number>();
const MAX_CACHE_SIZE = 20_000;

export interface SimilarityCacheStats {
  distance: number;
  ratio: number;
  sequence: number;
}

export class Levenshtein {
  static ratio(seq1: string, seq2: string): number {
    const key = cacheKey(seq1, seq2);
    const cached = ratioCache.get(key);
    if (cached != null) {
      return cached;
    }

    const distance = Levenshtein.distance(seq1, seq2);
    const length = Math.max(seq1.length, seq2.length);
    const ratio = length > 0 ? 1 - distance / length : 1;

    setBoundedCache(ratioCache, key, ratio);
    return ratio;
  }

  static distance(seq1: string, seq2: string): number {
    const key = cacheKey(seq1, seq2);
    const cached = distanceCache.get(key);
    if (cached != null) {
      return cached;
    }

    let len1 = seq1.length;
    let len2 = seq2.length;

    if (len1 === 0) {
      setBoundedCache(distanceCache, key, len2);
      return len2;
    }

    if (len2 === 0) {
      setBoundedCache(distanceCache, key, len1);
      return len1;
    }

    if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.7) {
      const result = Math.max(len1, len2);
      setBoundedCache(distanceCache, key, result);
      return result;
    }

    if (len1 > len2) {
      [seq1, seq2] = [seq2, seq1];
      [len1, len2] = [len2, len1];
    }

    const result = len1 <= 3 ? simpleDistance(seq1, seq2) : matrixDistance(seq1, seq2);
    setBoundedCache(distanceCache, key, result);
    return result;
  }
}

export function levenshteinSimilarity(cand1: string, cand2: string): number {
  const maxLength = Math.max(cand1.length, cand2.length);
  if (maxLength === 0) {
    return 1;
  }

  return 1 - (Levenshtein.distance(cand1, cand2) / maxLength);
}

export function sequenceSimilarity(cand1: string, cand2: string): number {
  const key = cacheKey(cand1, cand2);
  const cached = sequenceCache.get(key);
  if (cached != null) {
    return cached;
  }

  if (cand1 === cand2) {
    setBoundedCache(sequenceCache, key, 1);
    return 1;
  }

  if (!aggressivePreFilter(cand1, cand2)) {
    setBoundedCache(sequenceCache, key, 0);
    return 0;
  }

  const maxLength = Math.max(cand1.length, cand2.length);
  if (maxLength === 0) {
    setBoundedCache(sequenceCache, key, 0);
    return 0;
  }

  const lengthRatio = Math.min(cand1.length, cand2.length) / maxLength;
  if (lengthRatio < 0.3) {
    setBoundedCache(sequenceCache, key, 0);
    return 0;
  }

  const s1 = cand1.toLowerCase();
  const s2 = cand2.toLowerCase();
  const charUnion = new Set([...s1, ...s2]);
  if (charUnion.size === 0) {
    setBoundedCache(sequenceCache, key, 0);
    return 0;
  }

  const overlap = [...new Set(s1)].filter((char) => s2.includes(char)).length / charUnion.size;
  if (overlap < 0.2) {
    sequenceCache.set(key, 0);
    return 0;
  }

  if (maxLength <= 4) {
    const result = overlap * lengthRatio;
      setBoundedCache(sequenceCache, key, result);
      return result;
  }

  const words1 = s1.split(/\s+/).filter(Boolean);
  const words2 = s2.split(/\s+/).filter(Boolean);
  if (words1.length > 1 || words2.length > 1) {
    const wordUnion = new Set([...words1, ...words2]);
    if (wordUnion.size > 0) {
      const wordOverlap = [...new Set(words1)].filter((word) => words2.includes(word)).length / wordUnion.size;
      if (wordOverlap > 0.4) {
        setBoundedCache(sequenceCache, key, wordOverlap);
        return wordOverlap;
      }
    }
  }

  const trigrams1 = trigrams(s1);
  const trigrams2 = trigrams(s2);
  const trigramUnion = new Set([...trigrams1, ...trigrams2]);
  const trigramOverlap = trigramUnion.size === 0 ? 0 : [...trigrams1].filter((trigram) => trigrams2.has(trigram)).length / trigramUnion.size;
  const result = Math.min((0.3 * lengthRatio) + (0.2 * overlap) + (0.5 * trigramOverlap), 1);

  setBoundedCache(sequenceCache, key, result);
  return result;
}

export function jaroSimilarity(first: string, second: string): number {
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
  return first <= second ? `${first}\u0000${second}` : `${second}\u0000${first}`;
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

function trigrams(value: string): Set<string> {
  const result = new Set<string>();

  for (let index = 0; index <= value.length - 3; index += 1) {
    result.add(value.slice(index, index + 3));
  }

  return result;
}

function aggressivePreFilter(cand1: string, cand2: string): boolean {
  if (cand1 === cand2) {
    return true;
  }

  const len1 = cand1.length;
  const len2 = cand2.length;
  const maxLength = Math.max(len1, len2);

  if (Math.abs(len1 - len2) > maxLength * 0.6) {
    return false;
  }

  if (maxLength > 3) {
    if (cand1[0] !== cand2[0] || cand1[cand1.length - 1] !== cand2[cand2.length - 1]) {
      return false;
    }

    if (Math.min(len1, len2) >= 3 && cand1.slice(0, 2).toLowerCase() !== cand2.slice(0, 2).toLowerCase()) {
      return false;
    }
  }

  if (Math.abs(countSpaces(cand1) - countSpaces(cand2)) > 1) {
    return false;
  }

  return true;
}

function countSpaces(value: string): number {
  let count = 0;
  for (const char of value) {
    if (char === " ") {
      count += 1;
    }
  }
  return count;
}

function setBoundedCache(cache: Map<string, number>, key: string, value: number): void {
  if (!cache.has(key) && cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey != null) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, value);
}

export function getSimilarityCacheStats(): SimilarityCacheStats {
  return {
    distance: distanceCache.size,
    ratio: ratioCache.size,
    sequence: sequenceCache.size,
  };
}

export function clearSimilarityCaches(): void {
  distanceCache.clear();
  ratioCache.clear();
  sequenceCache.clear();
}
