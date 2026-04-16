import { loadStopwords } from "./stopwords.js";
import { splitSentences, tokenizeWords } from "./utils.js";

export interface SentenceSplitter {
  split(text: string): string[];
}

export interface Tokenizer {
  tokenize(text: string): string[];
}

export interface StopwordProvider {
  load(language: string): Set<string>;
}

export interface SimilarityStrategy {
  compare(a: string, b: string): number;
}

export interface CandidateNormalizerContext {
  readonly original: string;
  readonly language: string;
}

export interface CandidateNormalizer {
  normalize(token: string, context: CandidateNormalizerContext): string;
}

export interface LemmatizerContext {
  readonly original: string;
  readonly language: string;
}

export interface Lemmatizer {
  lemmatize(token: string, context: LemmatizerContext): string;
}

export interface CandidateFilterInput {
  readonly keyword: string;
  readonly normalizedKeyword: string;
  readonly ngramSize: number;
  readonly score: number;
  readonly occurrences: number;
  readonly sentenceIds: number[];
}

export interface KeywordScorer {
  score(candidates: KeywordResult[]): KeywordResult[];
}

export interface TextProcessor {
  splitSentences(text: string): string[];
  tokenizeWords(text: string): string[];
}

export interface KeywordResult {
  keyword: string;
  normalizedKeyword: string;
  score: number;
  ngramSize: number;
  occurrences: number;
  sentenceIds: number[];
}

export const defaultSentenceSplitter: SentenceSplitter = {
  split: splitSentences,
};

export const defaultTokenizer: Tokenizer = {
  tokenize: tokenizeWords,
};

export const defaultStopwordProvider: StopwordProvider = {
  load: loadStopwords,
};

export const defaultTextProcessor: TextProcessor = {
  splitSentences,
  tokenizeWords,
};
