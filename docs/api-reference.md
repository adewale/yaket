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
  features?: string[] | null;
  stopwords?: Iterable<string>;
  textProcessor?: TextProcessor;
  sentenceSplitter?: SentenceSplitter;
  tokenizer?: Tokenizer;
  stopwordProvider?: StopwordProvider;
  dedupStrategy?: SimilarityStrategy | ((a: string, b: string) => number);
  similarityCache?: SimilarityCache;
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
| `dedupFunc` | exactly `seqm`, `levs`, or `jaro` | `seqm` |
| `dedupLim` | dedup similarity threshold | `0.9` |
| `windowSize` | co-occurrence window size | `1` |
| `sentenceSplitter` | override only the sentence splitter | bundled |
| `tokenizer` | override only the tokenizer | bundled |
| `similarityCache` | isolated cache for `seqm`, `levs`, and `jaro` memoization | shared module-level default |

`KeywordExtractorOptions` is exported as an *import-compatible* alias for
`YakeOptions` (structurally identical). It is not value-compatible: the
constructor rejects the legacy snake_case keys at runtime, and `dedupFunc`
throws on unknown values instead of silently aliasing them. Both error
messages name the offending key/value and the canonical replacement.

Yaket 0.6 dropped the legacy snake_case aliases (`lan`, `dedup_lim`,
`dedup_func`, `windowsSize`, `window_size`), the `extract_keywords()` method,
and the dedup-function value aliases (`leve`, `jaro_winkler`,
`sequencematcher`). Passing any of these — even via a plain JS object,
JSON payload, or class on the prototype chain — now throws a `TypeError`.
See `docs/migration-bobbin-0.6.md` for the migration recipe.

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

All three resolve language with the same precedence rule:
`options.language ?? document.language ?? "en"`. The explicit option always
wins. The hook contexts (`beforeExtractText`, `afterExtractKeywords`)
report exactly the language the underlying extractor used.

`DocumentExtractionOptions` also supports:

- `includeTitleInText`
- `beforeExtractText(text, context)`
- `afterExtractKeywords(keywords, context)`

### `serializeDocumentKeywordResult(result)`
### `serializeDocumentKeywordResults(results)`
### `estimateSerializedBytes(value)`

Use these when pipeline consumers need deterministic caching, diffing, or lightweight payload-size estimation.

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

All four similarity helpers accept an optional final `SimilarityCache`
argument and memoize their results inside it. When omitted, they share
the bounded module-level default cache.

### `createSimilarityCache(options?)`

Returns a `SimilarityCache` with isolated `distance`, `ratio`, `sequence`,
and `jaro` `Map`s plus `stats()` and `clear()` methods. Pass `{ maxSize }`
to set the bounded LRU eviction threshold per map (default `20000`).
`maxSize` must be a positive integer; `0`, negatives, `NaN`, `Infinity`,
and non-integers throw a `RangeError`. Use this for long-running edge
workers, per-request cache scopes, tests that must not leak into the
module-level default, or benchmarks that need to reset state between
runs.

### `getSimilarityCacheStats`
### `clearSimilarityCaches`

Operate on the module-level default cache only. Custom caches expose
the same operations through their own `.stats()` and `.clear()` methods.

### `SimilarityCache` / `SimilarityCacheStats`

Typed interfaces re-exported from the public surface. `SimilarityCacheStats`
is `{ distance: number; ratio: number; sequence: number; jaro: number }`.

## Extension Types

Yaket exports the main extension interfaces directly:

- `TextProcessor` (combined `splitSentences` + `tokenizeWords` surface)
- `SentenceSplitter` (just `split(text) => string[]`)
- `Tokenizer` (just `tokenize(text) => string[]`)
- `StopwordProvider`
- `SimilarityStrategy`
- `CandidateNormalizer`
- `Lemmatizer`
- `SingleWordScorer`
- `MultiWordScorer`
- `KeywordScorer`
- `CandidateFilterInput`

The default values `defaultTextProcessor`, `defaultSentenceSplitter`,
`defaultTokenizer`, and `defaultStopwordProvider` are also exported so
custom strategies can compose with the bundled behavior without
re-implementing it.

`sentenceSplitter` and `tokenizer` take precedence over `textProcessor`
for the half they cover. The other half falls back to whichever of
`textProcessor` or the bundled default is available.

Lemmatization remains hook-only. Yaket does not implement upstream-style string backend selectors such as `"spacy"` or `"nltk"` inside the extraction core. See `docs/lemmatization-evaluation.md` for the rationale.

## Choosing an API

| Need | Recommended API |
|---|---|
| simplest keyword extraction | `extract` or `extractKeywords` |
| richer result metadata | `extractKeywordDetails` |
| repeated extraction with shared config | `KeywordExtractor` |
| Bobbin-style compatibility | `extractYakeKeywords` |
| document pipeline integration | `extractFromDocument*` |
| custom stopword behavior | `createStopwordSet` / `createStaticStopwordProvider` |
