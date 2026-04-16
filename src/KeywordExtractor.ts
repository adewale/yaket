import { ComposedWord } from "./ComposedWord.js";
import { DataCore } from "./DataCore.js";
import { jaroSimilarity, Levenshtein, levenshteinSimilarity, sequenceSimilarity } from "./similarity.js";
import { loadStopwords } from "./stopwords.js";

type DedupFunction = (cand1: string, cand2: string) => number;

export interface KeywordExtractorOptions {
  lan?: string;
  language?: string;
  n?: number;
  dedupLim?: number;
  dedup_lim?: number;
  dedupFunc?: string;
  dedup_func?: string;
  windowSize?: number;
  windowsSize?: number;
  window_size?: number;
  top?: number;
  features?: string[] | null;
  stopwords?: Iterable<string>;
}

export type KeywordScore = [keyword: string, score: number];

interface NormalizedConfig {
  lan: string;
  n: number;
  dedupLim: number;
  dedupFunc: string;
  windowSize: number;
  top: number;
  features: string[] | null;
}

export class KeywordExtractor {
  readonly config: NormalizedConfig;
  readonly stopwordSet: Set<string>;
  private readonly dedupFunction: DedupFunction;

  constructor(options: KeywordExtractorOptions = {}) {
    this.config = {
      lan: options.lan ?? options.language ?? "en",
      n: options.n ?? 3,
      dedupLim: options.dedupLim ?? options.dedup_lim ?? 0.9,
      dedupFunc: options.dedupFunc ?? options.dedup_func ?? "seqm",
      windowSize: options.windowSize ?? options.windowsSize ?? options.window_size ?? 1,
      top: options.top ?? 20,
      features: options.features ?? null,
    };

    this.stopwordSet = options.stopwords == null
      ? loadStopwords(this.config.lan)
      : new Set([...options.stopwords].map((value) => value.toLowerCase()));
    this.dedupFunction = this.getDedupFunction(this.config.dedupFunc);
  }

  levs(cand1: string, cand2: string): number {
    return levenshteinSimilarity(cand1, cand2);
  }

  seqm(cand1: string, cand2: string): number {
    return sequenceSimilarity(cand1, cand2);
  }

  jaro(cand1: string, cand2: string): number {
    return jaroSimilarity(cand1, cand2);
  }

  extractKeywords(text: string | null | undefined): KeywordScore[] {
    if (!text) {
      return [];
    }

    const normalizedText = text.replaceAll("\n", " ");
    const core = new DataCore(normalizedText, this.stopwordSet, {
      windowsSize: this.config.windowSize,
      n: this.config.n,
    });

    core.buildSingleTermsFeatures(this.config.features);
    core.buildMultTermsFeatures(this.config.features);

    const candidates = [...core.candidates.values()]
      .filter((candidate) => candidate.isValid())
      .sort((left, right) => compareCandidates(left, right));

    if (this.config.dedupLim >= 1) {
      return candidates.slice(0, this.config.top).map((candidate) => [candidate.uniqueKw, candidate.h]);
    }

    const resultSet: Array<[number, ComposedWord]> = [];
    for (const candidate of candidates) {
      let shouldAdd = true;

      for (const [, selected] of resultSet) {
        if (this.dedupFunction(candidate.uniqueKw, selected.uniqueKw) > this.config.dedupLim) {
          shouldAdd = false;
          break;
        }
      }

      if (shouldAdd) {
        resultSet.push([candidate.h, candidate]);
      }

      if (resultSet.length === this.config.top) {
        break;
      }
    }

    return resultSet.map(([score, candidate]) => [candidate.kw, score]);
  }

  extract_keywords(text: string | null | undefined): KeywordScore[] {
    return this.extractKeywords(text);
  }

  private getDedupFunction(funcName: string): DedupFunction {
    switch (funcName.toLowerCase()) {
      case "jaro":
      case "jaro_winkler":
        return this.jaro.bind(this);
      case "sequencematcher":
      case "seqm":
        return this.seqm.bind(this);
      case "leve":
      case "levs":
      default:
        return this.levs.bind(this);
    }
  }
}

export function extractKeywords(text: string, options: KeywordExtractorOptions = {}): KeywordScore[] {
  return new KeywordExtractor(options).extractKeywords(text);
}

export { Levenshtein };

function compareCandidates(left: ComposedWord, right: ComposedWord): number {
  if (left.h !== right.h) {
    return left.h - right.h;
  }

  return left.order - right.order;
}
