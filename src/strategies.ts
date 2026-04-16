import type { ComposedWord } from "./ComposedWord.js";
import type { SingleWord } from "./SingleWord.js";
import { loadStopwords } from "./stopwords.js";
import { splitSentences, tokenizeWords } from "./utils.js";

/**
 * Splits raw text into sentence strings.
 */
export interface SentenceSplitter {
  split(text: string): string[];
}

/**
 * Splits a sentence or text fragment into tokens.
 */
export interface Tokenizer {
  tokenize(text: string): string[];
}

/**
 * Loads a stopword set for a language.
 */
export interface StopwordProvider {
  load(language: string): Set<string>;
}

/**
 * Compares two candidate strings for deduplication.
 */
export interface SimilarityStrategy {
  compare(a: string, b: string): number;
}

/**
 * Context passed to candidate normalizers.
 */
export interface CandidateNormalizerContext {
  readonly original: string;
  readonly language: string;
}

/**
 * Normalizes tokens before candidate aggregation.
 */
export interface CandidateNormalizer {
  normalize(token: string, context: CandidateNormalizerContext): string;
}

/**
 * Context passed to lemmatizers.
 */
export interface LemmatizerContext {
  readonly original: string;
  readonly language: string;
}

/**
 * Optional token lemmatization hook.
 */
export interface Lemmatizer {
  lemmatize(token: string, context: LemmatizerContext): string;
}

/**
 * Candidate metadata available to user-provided filters.
 */
export interface CandidateFilterInput {
  readonly keyword: string;
  readonly normalizedKeyword: string;
  readonly ngramSize: number;
  readonly score: number;
  readonly occurrences: number;
  readonly sentenceIds: number[];
}

/**
 * Post-processing scorer hook for ranked candidates.
 */
export interface KeywordScorer {
  score(candidates: KeywordResult[]): KeywordResult[];
}

/**
 * Context passed to single-word scorers.
 */
export interface SingleWordScoreContext {
  readonly maxTf: number;
  readonly avgTf: number;
  readonly stdTf: number;
  readonly numberOfSentences: number;
  readonly features?: string[] | null;
}

/**
 * Hook for replacing the internal YAKE single-word score formula.
 */
export interface SingleWordScorer {
  score(term: SingleWord, context: SingleWordScoreContext): number;
}

/**
 * Context passed to multi-word scorers.
 */
export interface MultiWordScoreContext {
  readonly features?: string[] | null;
}

/**
 * Hook for replacing the internal YAKE multi-word score formula.
 */
export interface MultiWordScorer {
  score(candidate: ComposedWord, context: MultiWordScoreContext): number;
}

/**
 * Combined sentence-splitting and tokenization surface.
 */
export interface TextProcessor {
  splitSentences(text: string): string[];
  tokenizeWords(text: string): string[];
}

/**
 * Rich keyword record returned by detailed extraction APIs.
 */
export interface KeywordResult {
  keyword: string;
  normalizedKeyword: string;
  score: number;
  ngramSize: number;
  occurrences: number;
  sentenceIds: number[];
}

/**
 * Default sentence splitter used by Yaket.
 */
export const defaultSentenceSplitter: SentenceSplitter = {
  split: splitSentences,
};

/**
 * Default tokenization strategy used by Yaket.
 */
export const defaultTokenizer: Tokenizer = {
  tokenize: tokenizeWords,
};

/**
 * Default stopword loader backed by bundled assets.
 */
export const defaultStopwordProvider: StopwordProvider = {
  load: loadStopwords,
};

/**
 * Default text processor combining the bundled sentence splitter and tokenizer.
 */
export const defaultTextProcessor: TextProcessor = {
  splitSentences,
  tokenizeWords,
};
