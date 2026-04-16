import { ComposedWord } from "./ComposedWord.js";
import { DataCore } from "./DataCore.js";
import type { CandidateFilterInput, CandidateNormalizer, KeywordResult, KeywordScorer, Lemmatizer, SimilarityStrategy, StopwordProvider, TextProcessor } from "./strategies.js";
import { defaultStopwordProvider } from "./strategies.js";
import { jaroSimilarity, Levenshtein, levenshteinSimilarity, sequenceSimilarity } from "./similarity.js";

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
  textProcessor?: TextProcessor;
  stopwordProvider?: StopwordProvider;
  dedupStrategy?: SimilarityStrategy | DedupFunction;
  lemmatizer?: Lemmatizer;
  candidateNormalizer?: CandidateNormalizer;
  keywordScorer?: KeywordScorer | ((candidates: KeywordResult[]) => KeywordResult[]);
  candidateFilter?: (candidate: CandidateFilterInput) => boolean;
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
  readonly textProcessor?: TextProcessor;
  readonly lemmatizer: Lemmatizer | null;
  readonly candidateNormalizer: CandidateNormalizer | null;
  readonly keywordScorer: ((candidates: KeywordResult[]) => KeywordResult[]) | null;
  readonly candidateFilter?: (candidate: CandidateFilterInput) => boolean;
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

    this.textProcessor = options.textProcessor;
    this.lemmatizer = options.lemmatizer ?? null;
    this.candidateNormalizer = options.candidateNormalizer ?? null;
    this.keywordScorer = options.keywordScorer == null ? null : getKeywordScorer(options.keywordScorer);
    this.candidateFilter = options.candidateFilter;
    this.stopwordSet = options.stopwords == null
      ? (options.stopwordProvider ?? defaultStopwordProvider).load(this.config.lan)
      : new Set([...options.stopwords].map((value) => value.toLowerCase()));
    this.dedupFunction = options.dedupStrategy == null
      ? this.getDedupFunction(this.config.dedupFunc)
      : getStrategyFunction(options.dedupStrategy);
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
    return this.extractKeywordDetails(text).map((item) => [item.keyword, item.score]);
  }

  extractKeywordDetails(text: string | null | undefined): KeywordResult[] {
    if (!text) {
      return [];
    }

    const core = new DataCore(text, this.stopwordSet, {
      windowsSize: this.config.windowSize,
      n: this.config.n,
      textProcessor: this.textProcessor,
      lemmatizer: this.lemmatizer,
      candidateNormalizer: this.candidateNormalizer,
      language: this.config.lan,
    });

    core.buildSingleTermsFeatures(this.config.features);
    core.buildMultTermsFeatures(this.config.features);

    const candidates = [...core.candidates.values()]
      .filter((candidate) => candidate.isValid())
      .sort((left, right) => compareCandidates(left, right));

    const candidateDetails = candidates
      .map((candidate) => toKeywordResult(candidate))
      .filter((candidate) => this.candidateFilter?.(candidate) ?? true);
    const scoredCandidateDetails = this.keywordScorer == null ? candidateDetails : this.keywordScorer(candidateDetails);

    if (this.config.dedupLim >= 1) {
      return scoredCandidateDetails.slice(0, this.config.top);
    }

    const resultSet: KeywordResult[] = [];
    for (const candidate of scoredCandidateDetails) {
      let shouldAdd = true;

      for (const selected of resultSet) {
        if (this.dedupFunction(candidate.normalizedKeyword, selected.normalizedKeyword) > this.config.dedupLim) {
          shouldAdd = false;
          break;
        }
      }

      if (shouldAdd) {
        resultSet.push(candidate);
      }

      if (resultSet.length === this.config.top) {
        break;
      }
    }

    return resultSet;
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

export function extractKeywordDetails(text: string, options: KeywordExtractorOptions = {}): KeywordResult[] {
  return new KeywordExtractor(options).extractKeywordDetails(text);
}

export function createKeywordExtractor(options: KeywordExtractorOptions = {}): KeywordExtractor {
  return new KeywordExtractor(options);
}

export { Levenshtein };

function getStrategyFunction(strategy: SimilarityStrategy | DedupFunction): DedupFunction {
  return typeof strategy === "function" ? strategy : strategy.compare.bind(strategy);
}

function getKeywordScorer(strategy: KeywordScorer | ((candidates: KeywordResult[]) => KeywordResult[])): (candidates: KeywordResult[]) => KeywordResult[] {
  return typeof strategy === "function" ? strategy : strategy.score.bind(strategy);
}

function toKeywordResult(candidate: ComposedWord): KeywordResult {
  const sentenceIds = [...new Set(candidate.terms.flatMap((term) => [...term.occurs.keys()]))].sort((left, right) => left - right);
  const occurrences = candidate.tf;

  return {
    keyword: candidate.kw,
    normalizedKeyword: candidate.uniqueKw,
    score: candidate.h,
    ngramSize: candidate.size,
    occurrences,
    sentenceIds,
  };
}

function compareCandidates(left: ComposedWord, right: ComposedWord): number {
  if (left.h !== right.h) {
    return left.h - right.h;
  }

  return left.order - right.order;
}
