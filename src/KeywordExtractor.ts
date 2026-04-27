import { ComposedWord } from "./ComposedWord.js";
import { DataCore } from "./DataCore.js";
import type { CandidateFilterInput, CandidateNormalizer, KeywordResult, KeywordScorer, Lemmatizer, MultiWordScorer, SentenceSplitter, SimilarityStrategy, SingleWordScorer, StopwordProvider, TextProcessor, Tokenizer } from "./strategies.js";
import { defaultStopwordProvider } from "./strategies.js";
import { jaroSimilarity, Levenshtein, levenshteinSimilarity, sequenceSimilarity, type SimilarityCache } from "./similarity.js";
import { splitSentences as defaultSplitSentences, tokenizeWords as defaultTokenizeWords } from "./utils.js";

type DedupFunction = (cand1: string, cand2: string) => number;

const VALID_DEDUP_FUNC_NAMES = new Set(["seqm", "levs", "jaro"]);

/**
 * Snake_case keys removed in 0.6. Reject these at runtime so callers that
 * construct options from a plain JS object or JSON payload (where the
 * TypeScript guard does not apply) get a loud error instead of silent
 * fallback to defaults.
 */
const REMOVED_OPTION_KEYS: ReadonlyArray<[string, string]> = [
  ["lan", "language"],
  ["dedup_lim", "dedupLim"],
  ["dedup_func", "dedupFunc"],
  ["windowsSize", "windowSize"],
  ["window_size", "windowSize"],
];

function assertNoRemovedOptionKeys(options: object): void {
  for (const [legacy, canonical] of REMOVED_OPTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(options, legacy)) {
      throw new TypeError(
        `Yaket option "${legacy}" was removed in 0.6; use "${canonical}" instead. See docs/migration-bobbin-0.6.md.`,
      );
    }
  }
}

/**
 * Public configuration for Yaket extraction.
 *
 * Only canonical camelCase names are accepted. The legacy snake_case aliases
 * (`lan`, `dedup_lim`, `dedup_func`, `windowsSize`, `window_size`) and the
 * `extract_keywords()` method that mirrored Python YAKE were removed in 0.6.
 */
export interface YakeOptions {
  language?: string;
  n?: number;
  dedupLim?: number;
  dedupFunc?: string;
  windowSize?: number;
  top?: number;
  features?: string[] | null;
  stopwords?: Iterable<string>;
  textProcessor?: TextProcessor;
  sentenceSplitter?: SentenceSplitter;
  tokenizer?: Tokenizer;
  stopwordProvider?: StopwordProvider;
  dedupStrategy?: SimilarityStrategy | DedupFunction;
  similarityCache?: SimilarityCache;
  lemmatizer?: Lemmatizer;
  candidateNormalizer?: CandidateNormalizer;
  singleWordScorer?: SingleWordScorer;
  multiWordScorer?: MultiWordScorer;
  keywordScorer?: KeywordScorer | ((candidates: KeywordResult[]) => KeywordResult[]);
  candidateFilter?: (candidate: CandidateFilterInput) => boolean;
}

/**
 * Import-compatible alias for the public option type.
 *
 * In 0.6 this is structurally identical to `YakeOptions`; the alias keeps
 * existing `import { KeywordExtractorOptions } from "..."` declarations
 * compiling. It is NOT backwards-compatible at the value level — the
 * legacy snake_case keys (`lan`, `dedup_lim`, `dedup_func`, `windowsSize`,
 * `window_size`) are rejected at construction time. See
 * `docs/migration-bobbin-0.6.md`.
 */
export type KeywordExtractorOptions = YakeOptions;

/**
 * Tuple form of the simplified YAKE output.
 */
export type KeywordScore = [keyword: string, score: number];

interface NormalizedConfig {
  language: string;
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
  readonly singleWordScorer: SingleWordScorer | null;
  readonly multiWordScorer: MultiWordScorer | null;
  readonly keywordScorer: ((candidates: KeywordResult[]) => KeywordResult[]) | null;
  readonly candidateFilter?: (candidate: CandidateFilterInput) => boolean;
  readonly similarityCache: SimilarityCache | null;
  private readonly dedupFunction: DedupFunction;

  /**
   * Creates a reusable keyword extractor with normalized options.
   */
  constructor(options: KeywordExtractorOptions = {}) {
    assertNoRemovedOptionKeys(options);

    if (typeof options.lemmatizer === "string") {
      throw new TypeError("String lemmatizer backends such as 'spacy' or 'nltk' are not implemented in Yaket; provide a hook object with a lemmatize() method instead.");
    }

    this.config = {
      language: options.language ?? "en",
      n: options.n ?? 3,
      dedupLim: options.dedupLim ?? 0.9,
      dedupFunc: options.dedupFunc ?? "seqm",
      windowSize: options.windowSize ?? 1,
      top: options.top ?? 20,
      features: options.features ?? null,
    };

    this.textProcessor = composeTextProcessor(options.textProcessor, options.sentenceSplitter, options.tokenizer);
    this.lemmatizer = options.lemmatizer ?? null;
    this.candidateNormalizer = options.candidateNormalizer ?? null;
    this.singleWordScorer = options.singleWordScorer ?? null;
    this.multiWordScorer = options.multiWordScorer ?? null;
    this.keywordScorer = options.keywordScorer == null ? null : getKeywordScorer(options.keywordScorer);
    this.candidateFilter = options.candidateFilter;
    this.similarityCache = options.similarityCache ?? null;
    this.stopwordSet = options.stopwords == null
      ? (options.stopwordProvider ?? defaultStopwordProvider).load(this.config.language)
      : new Set([...options.stopwords].map((value) => value.toLowerCase()));
    this.dedupFunction = options.dedupStrategy == null
      ? this.getDedupFunction(this.config.dedupFunc)
      : getStrategyFunction(options.dedupStrategy);
  }

  /**
   * Levenshtein-based dedup similarity.
   */
  levs(cand1: string, cand2: string): number {
    return this.similarityCache == null
      ? levenshteinSimilarity(cand1, cand2)
      : levenshteinSimilarity(cand1, cand2, this.similarityCache);
  }

  /**
   * Sequence-style dedup similarity that approximates upstream YAKE's optimized path.
   */
  seqm(cand1: string, cand2: string): number {
    return this.similarityCache == null
      ? sequenceSimilarity(cand1, cand2)
      : sequenceSimilarity(cand1, cand2, this.similarityCache);
  }

  /**
   * Jaro-based dedup similarity.
   */
  jaro(cand1: string, cand2: string): number {
    return this.similarityCache == null
      ? jaroSimilarity(cand1, cand2)
      : jaroSimilarity(cand1, cand2, this.similarityCache);
  }

  /**
   * Extracts simplified keyword-score tuples.
   */
  extractKeywords(text: string | null | undefined): KeywordScore[] {
    return this.extractKeywordDetails(text).map((item) => [item.keyword, item.score]);
  }

  /**
   * Extracts richer keyword records with normalized forms and metadata.
   */
  extractKeywordDetails(text: string | null | undefined): KeywordResult[] {
    if (!text) {
      return [];
    }

    const core = new DataCore(text, this.stopwordSet, {
      windowSize: this.config.windowSize,
      n: this.config.n,
      textProcessor: this.textProcessor,
      lemmatizer: this.lemmatizer,
      candidateNormalizer: this.candidateNormalizer,
      singleWordScorer: this.singleWordScorer,
      multiWordScorer: this.multiWordScorer,
      language: this.config.language,
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

  private getDedupFunction(funcName: string): DedupFunction {
    const lower = funcName.toLowerCase();
    if (!VALID_DEDUP_FUNC_NAMES.has(lower)) {
      throw new TypeError(
        `Unknown dedupFunc "${funcName}"; expected one of "seqm", "levs", "jaro".`,
      );
    }
    switch (lower) {
      case "jaro":
        return this.jaro.bind(this);
      case "seqm":
        return this.seqm.bind(this);
      case "levs":
        return this.levs.bind(this);
      default:
        // Unreachable: VALID_DEDUP_FUNC_NAMES guard rules out everything else.
        throw new TypeError(`Unreachable dedupFunc dispatch for "${funcName}"`);
    }
  }
}

/**
 * One-shot helper for tuple-style extraction.
 */
export function extractKeywords(text: string, options: KeywordExtractorOptions = {}): KeywordScore[] {
  return new KeywordExtractor(options).extractKeywords(text);
}

/**
 * Short alias for `extractKeywords()`.
 */
export function extract(text: string, options: KeywordExtractorOptions = {}): KeywordScore[] {
  return extractKeywords(text, options);
}

/**
 * One-shot helper for detailed extraction.
 */
export function extractKeywordDetails(text: string, options: KeywordExtractorOptions = {}): KeywordResult[] {
  return new KeywordExtractor(options).extractKeywordDetails(text);
}

/**
 * Factory helper for reusable extractors.
 */
export function createKeywordExtractor(options: KeywordExtractorOptions = {}): KeywordExtractor {
  return new KeywordExtractor(options);
}

export { Levenshtein };

function getStrategyFunction(strategy: SimilarityStrategy | DedupFunction): DedupFunction {
  return typeof strategy === "function" ? strategy : strategy.compare.bind(strategy);
}

function composeTextProcessor(
  textProcessor: TextProcessor | undefined,
  sentenceSplitter: SentenceSplitter | undefined,
  tokenizer: Tokenizer | undefined,
): TextProcessor | undefined {
  if (sentenceSplitter == null && tokenizer == null) {
    return textProcessor;
  }

  // Default to bundled behavior when only one half is overridden, or when only
  // a TextProcessor is provided alongside one of the granular interfaces.
  return {
    splitSentences: sentenceSplitter != null
      ? (text) => sentenceSplitter.split(text)
      : textProcessor != null
        ? (text) => textProcessor.splitSentences(text)
        : (text) => defaultSplitSentences(text),
    tokenizeWords: tokenizer != null
      ? (text) => tokenizer.tokenize(text)
      : textProcessor != null
        ? (text) => textProcessor.tokenizeWords(text)
        : (text) => defaultTokenizeWords(text),
  };
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
  const scoreDelta = left.h - right.h;
  if (Math.abs(scoreDelta) > 1e-15) {
    return scoreDelta;
  }

  if (isSlidingNgramTie(left, right)) {
    return right.order - left.order;
  }

  return left.order - right.order;
}

function isSlidingNgramTie(left: ComposedWord, right: ComposedWord): boolean {
  if (left.size !== right.size || left.size < 3) {
    return false;
  }

  const leftWords = left.uniqueKw.split(" ");
  const rightWords = right.uniqueKw.split(" ");
  if (leftWords.length !== rightWords.length || leftWords.length < 3) {
    return false;
  }

  const leftTail = leftWords.slice(1).join(" ");
  const rightHead = rightWords.slice(0, -1).join(" ");
  const rightTail = rightWords.slice(1).join(" ");
  const leftHead = leftWords.slice(0, -1).join(" ");

  return leftTail === rightHead || rightTail === leftHead;
}
