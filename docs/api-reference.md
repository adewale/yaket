# API Reference

This document summarizes the main public API of `@ade_oshineye/yaket`.

## Core Extraction

### `extract(text, options?)`

Short alias for `extractKeywords(text, options?)`.

### `extractKeywords(text, options?)`

Returns ranked keyword-score tuples:

```ts
type KeywordScore = [keyword: string, score: number]
```

Use this when you want the simplest YAKE-style output.

Returned `keyword` strings preserve the observed surface case from the input text.

### `extractKeywordDetails(text, options?)`

Returns richer keyword metadata:

```ts
type YakeResult = {
  keyword: string;
  normalizedKeyword: string;
  score: number;
  ngramSize: number;
  occurrences: number;
  sentenceIds: number[];
}
```

Use this when you need normalized forms, sentence spread, or downstream weighting logic.

- `keyword`: original surface form as it appeared in the input text
- `normalizedKeyword`: normalized lowercase form used for matching, deduplication, and downstream comparison

### `KeywordExtractor`

Reusable extractor for repeated calls with the same configuration.

### `createKeywordExtractor(options?)`

Factory helper for codebases that prefer pure-construction helpers over `new`.

## Main Options

```ts
type YakeOptions = {
  language?: string;
  n?: number;
  top?: number;
  dedupLim?: number;
  dedupFunc?: string;
  windowSize?: number;
  stopwords?: Iterable<string>;
  textProcessor?: TextProcessor;
  stopwordProvider?: StopwordProvider;
  dedupStrategy?: SimilarityStrategy | ((a: string, b: string) => number);
  lemmatizer?: Lemmatizer;
  candidateNormalizer?: CandidateNormalizer;
  singleWordScorer?: SingleWordScorer;
  multiWordScorer?: MultiWordScorer;
  keywordScorer?: KeywordScorer | ((candidates: YakeResult[]) => YakeResult[]);
  candidateFilter?: (candidate: CandidateFilterInput) => boolean;
}
```

Most commonly used fields:

| Option | Meaning | Default |
|---|---|---|
| `language` | two-letter language code | `en` |
| `n` | maximum n-gram size | `3` |
| `top` | number of keywords to return | `20` |
| `dedupFunc` | `seqm`, `levs`, or `jaro`-style dedup | `seqm` |
| `dedupLim` | dedup similarity threshold | `0.9` |
| `windowSize` | co-occurrence window size | `1` |

Deprecated but still accepted aliases exist on `KeywordExtractorOptions` for compatibility:

- `lan`
- `dedup_lim`
- `windowsSize`
- `window_size`

## Adapters

### `extractYakeKeywords(text, n?, maxNgram?)`

Bobbin-compatible helper that returns:

```ts
type BobbinYakeResult = {
  keyword: string;
  score: number;
}
```

## Document Helpers

### `extractFromDocument(document, options?)`
### `extractFromDocuments(documents, options?)`
### `extractFromDocumentStream(documents, options?)`

Use these for ingestion pipelines, indexing jobs, and ETL-style processing.

## Stopwords

### `supportedLanguages`

Array of bundled two-letter stopword language keys.

### `loadStopwords(language)`

Loads a `Set<string>` for a language.

### `getStopwordText(language)`

Returns raw newline-separated stopword text.

### `bundledStopwordTexts`

Frozen map of bundled stopword text by language key.

### `STOPWORDS`

Readonly alias for `bundledStopwordTexts`.

### `createStopwordSet(language, options?)`

Creates a derived stopword set with `add`, `remove`, or `replace` options.

### `createStaticStopwordProvider(map)`

Creates a custom `StopwordProvider` from user-supplied stopword text or iterables.

## Highlighting

### `TextHighlighter`

Utility for wrapping extracted keywords in HTML markers.

## Similarity and Diagnostics

### `Levenshtein`
### `levenshteinSimilarity`
### `sequenceSimilarity`
### `jaroSimilarity`
### `getSimilarityCacheStats`
### `clearSimilarityCaches`

Use these mainly for diagnostics, experimentation, and custom dedup logic.

## Extension Types

Yaket exports the main extension interfaces directly:

- `TextProcessor`
- `StopwordProvider`
- `SimilarityStrategy`
- `CandidateNormalizer`
- `Lemmatizer`
- `SingleWordScorer`
- `MultiWordScorer`
- `KeywordScorer`
- `CandidateFilterInput`

## Choosing an API

| Need | Recommended API |
|---|---|
| simplest keyword extraction | `extract` or `extractKeywords` |
| richer result metadata | `extractKeywordDetails` |
| repeated extraction with shared config | `KeywordExtractor` |
| Bobbin-style compatibility | `extractYakeKeywords` |
| document pipeline integration | `extractFromDocument*` |
| custom stopword behavior | `createStopwordSet` / `createStaticStopwordProvider` |
