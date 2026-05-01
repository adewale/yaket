export { ComposedWord } from "./ComposedWord.js";
export { extractYakeKeywords, type BobbinYakeResult } from "./bobbin.js";
export { DataCore } from "./DataCore.js";
export { parseYakeOptions, type DedupFunctionName, type OptionError, type PositiveInt, type Result, type Similarity01, type YakeConfig } from "./config.js";
export { DEFAULT_YAKE_OPTIONS } from "./defaults.js";
export {
  estimateSerializedBytes,
  extractFromDocument,
  extractFromDocuments,
  extractFromDocumentStream,
  serializeDocumentKeywordResult,
  serializeDocumentKeywordResults,
  type DocumentExtractionOptions,
  type DocumentKeywordHookContext,
  type DocumentKeywordResult,
  type DocumentTextHookContext,
  type InputDocument,
} from "./document.js";
export { type FeatureName } from "./features.js";
export { TextHighlighter, type TextHighlighterOptions } from "./highlight.js";
export { KeywordExtractor, createKeywordExtractor, extract, extractKeywordDetails, extractKeywords, type KeywordExtractorOptions, type KeywordScore, type YakeOptions, Levenshtein } from "./KeywordExtractor.js";
export { SingleWord } from "./SingleWord.js";
export { defaultSentenceSplitter, defaultStopwordProvider, defaultTextProcessor, defaultTokenizer, type CandidateFilterInput, type CandidateNormalizer, type CandidateNormalizerContext, type KeywordResult, type KeywordScorer, type Lemmatizer, type LemmatizerContext, type MultiWordScoreContext, type MultiWordScorer, type SentenceSplitter, type SimilarityStrategy, type SingleWordScoreContext, type SingleWordScorer, type StopwordProvider, type TextProcessor, type Tokenizer } from "./strategies.js";
export { clearSimilarityCaches, createSimilarityCache, getSimilarityCacheStats, jaroSimilarity, levenshteinSimilarity, sequenceSimilarity, type SimilarityCache, type SimilarityCacheStats } from "./similarity.js";
export { STOPWORDS, bundledStopwordTexts, createStaticStopwordProvider, createStopwordSet, getStopwordText, loadStopwords, supportedLanguages } from "./stopwords.js";
export { DEFAULT_EXCLUDE, getTag, preFilter, splitSentences, STOPWORD_WEIGHT, tokenizeSentences, tokenizeWords } from "./utils.js";
export type { KeywordResult as YakeResult } from "./strategies.js";
