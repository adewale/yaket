# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 0.6.0 - 2026-04-25

Multilingual parity, alias removal, and pluggable internals.

### Breaking

- removed the snake_case option aliases on `KeywordExtractorOptions`:
  `lan`, `dedup_lim`, `dedup_func`, `windowsSize`, `window_size`. Use
  `language`, `dedupLim`, `dedupFunc`, and `windowSize`.
- removed the `extract_keywords()` Python-style method on `KeywordExtractor`.
  Use `extractKeywords()` (or the standalone `extract()` / `extractKeywords()`
  helpers) instead.
- removed the dedup-function value aliases. `dedupFunc` (and `--dedup-func`)
  now accept exactly `seqm`, `levs`, or `jaro`. `leve`, `jaro_winkler`, and
  `sequencematcher` are rejected with a `TypeError`.
- renamed the public `KeywordExtractor.config.lan` field to
  `KeywordExtractor.config.language`.
- renamed the `DataCore` constructor option from `windowsSize` to
  `windowSize`. The internal field is renamed in lockstep.
- the CLI `--dedup-func` validation message now reads
  `must be one of levs, jaro, seqm`. The CLI help text was updated to match.

See `docs/migration-bobbin-0.6.md` for the migration recipe.

### Added

- ASCII architecture diagram alongside the existing Mermaid diagram in
  `docs/architecture.md` for environments without Mermaid support.
- `test/multilingual-parity.test.ts` locking head-parity against upstream
  Python YAKE 0.7.x for `pt`, `de`, `es`, `it`, `fr`, `nl`, `ru`, and `ar`,
  plus three property-based invariants (no-throw on arbitrary unicode,
  determinism, top-bound) exercised across bundled languages.
- `scripts/benchmark-multilingual.ts` and `docs/benchmarks/multilingual.md`
  reporting Yaket-vs-Python head match and top-K overlap per language.
  Wired in as `npm run benchmark:multilingual`.
- `docs/lemmatization-evaluation.md` documenting why bundled lemmatizers
  remain out of scope and what would change that decision.
- `sentenceSplitter` and `tokenizer` options on `KeywordExtractorOptions`
  so the existing `SentenceSplitter` and `Tokenizer` interfaces can be
  supplied independently of the combined `TextProcessor`.
- `createSimilarityCache({ maxSize? })` factory that returns a typed
  `SimilarityCache` instance with `stats()` and `clear()` methods. The
  similarity helpers (`sequenceSimilarity`, `levenshteinSimilarity`,
  `Levenshtein.distance`, `Levenshtein.ratio`, `jaroSimilarity`) now accept
  the cache as an optional final parameter.
- `similarityCache` option on `KeywordExtractor` so workers, tests, and
  benchmarks can isolate cache state from the module-level default.
- `docs/migration-bobbin-0.6.md` migration guide.
- `test/multilingual-corpus.test.ts` covering 21 documents across 7 bundled languages
  (`de`, `fr`, `es`, `it`, `pt`, `nl`, `ru`) with 168/210 head slots locked
  against upstream YAKE 0.7.x. Documented the residual float-precision tie-break
  drift items in `docs/algorithm-drift.md`.
- `test/bundle-size.test.ts` and `scripts/bundle-size.ts`. The test asserts
  the worker-target ESM bundle stays inside a 64 KiB gzipped budget and
  contains no Node built-ins (`fs`, `path`, `child_process`, `os`). The
  script writes a markdown report to `docs/benchmarks/bundle-size.md`.
- mutation-testing audit at `docs/audits/mutation-testing-2026-04-26.md`
  with a 68.77 % overall Stryker mutation score (above the 60 % break
  threshold). New `test/keyword-extractor-defaults.test.ts` and
  `test/dedup-boundaries.test.ts` kill the highest-value `KeywordExtractor`
  survivors (default option values, dedup threshold strict-greater
  semantics, early-exit branch).
- `stryker.conf.json` switched to `coverageAnalysis: "perTest"` and
  dropped the TypeScript checker so a full mutation run completes in
  ~8 minutes.
- Runtime validation of removed options. Passing `lan`, `dedup_lim`,
  `dedup_func`, `windowsSize`, or `window_size` through a plain JS object
  (where the TypeScript guard does not apply) now throws a `TypeError`
  rather than silently falling back to the default.
- `createSimilarityCache({ maxSize })` now validates that `maxSize` is a
  positive integer; `0`, negatives, `NaN`, `Infinity`, and non-integers
  throw a `RangeError`.
- Stricter bundle-size leak detection in `test/bundle-size.test.ts` and
  `scripts/bundle-size.ts`: 17 Node built-in module names are checked
  under both quote styles and the bare-vs-`node:`-prefixed forms, plus
  dynamic `import()` and `require()` of `node:*` modules.
- `KeywordExtractorOptions` doc comment clarified — the alias is
  *import-compatible*, not value-compatible (the legacy keys are rejected
  at construction time).
- `jaroSimilarity` now memoizes results in the supplied `SimilarityCache`
  on equal terms with `sequenceSimilarity` and `Levenshtein.ratio` /
  `.distance`. The `SimilarityCacheStats` interface gained a `jaro: number`
  field; `clear()` empties the Jaro map alongside the other three.
- Runtime legacy-option rejection now uses `key in options` (was
  `Object.prototype.hasOwnProperty.call`), so legacy keys that arrive on
  the prototype chain (e.g. `Object.create({ lan: "pt" })` or class
  hierarchies) also fail loudly instead of silently falling through.
- Extracted the bundle-leak forbidden-built-in list and pattern builder
  into `scripts/bundle-leak-detector.ts`. Both `scripts/bundle-size.ts`
  and `test/bundle-size.test.ts` now import from it, so they cannot
  drift apart.
- README and api-reference rewritten for the four-map `SimilarityCache`
  (added `jaro`) and updated multilingual limitation wording to reflect
  the actual residual drift instead of "broad multilingual parity
  coverage is deferred".

### Fixed

- Document-pipeline language precedence is now consistent across
  `extractFromDocument`, `extractFromDocuments`, and
  `extractFromDocumentStream`. All three resolve language as
  `options.language ?? document.language ?? "en"` (explicit option
  wins). Previously batch and stream let `document.language` win, while
  single-document let `options.language` win — different rules for the
  same conceptual operation.
- Document hook contexts now report the same language the extractor
  actually used. Previously the batch/stream `extractorForLanguage`
  cache silently re-applied `options.language ?? language` when
  building the underlying `KeywordExtractor`, so
  `beforeExtractText(text, ctx)` and `afterExtractKeywords(keywords,
  ctx)` could see `ctx.language === "fr"` while the extractor scored
  with `language: "en"`. Both halves now use the single
  `resolveLanguage(document, options)` helper.

### Fixed

- Portuguese ranking drift in upstream `test_n3_PT`. The tokenizer now
  matches segtok behavior when a sentence closer is the last token of the
  input (`Histórias."` → `[Histórias, ., "]`), removing duplicate
  `Histórias.` / `Conta-me Histórias.` candidates that had been crowding
  upstream-ranked entries out of the top 20. Yaket now exact-matches the
  upstream YAKE 9-element prefix for `test_n3_PT` and 10/10 head parity on
  the multilingual paragraphs tracked in `test/multilingual-parity.test.ts`
  for de/fr/it/pt/nl/ru.

## 0.5.3 - 2026-04-18

Release workflow and documentation alignment update.

### Changed

- aligned release-facing docs with the current Bobbin validation and npm publish behavior
- kept the browser demo pinned to the current published package version

### Fixed

- release workflow npm-token gating so tag pushes can complete the GitHub release flow without workflow-definition failures

### Notes

- npm publishing continues to depend on `NPM_TOKEN` being configured in GitHub Actions secrets

## 0.5.2 - 2026-04-18

Parity, ordering, and documentation consistency update.

### Changed

- clarified that `keyword` preserves source-text surface case while `normalizedKeyword` remains the normalized comparison key
- updated README, API reference, algorithm-drift notes, and TODO tracking so the current parity position is described consistently
- kept lemmatization hook-only by design and documented unsupported upstream-style string backend selectors more clearly

### Fixed

- sentence splitting drift that incorrectly merged sentences when the next sentence started with a lowercase token
- near-tie ordering for adjacent sliding 3-gram candidates such as `Kaggle data science` vs `Google Kaggle data`
- documentation drift around known ordering issues, which are now fixed for the tracked English parity cases
- tokenizer drift around abbreviation tokens, ellipses, guillemet boundaries, Arabic question-mark attachment, and parenthetical sentence endings
- Bobbin adapter leakage where unigram components of stronger multi-word entity phrases could survive into Bobbin topic extraction
- Unicode-sensitive `seqm` drift on emoji-containing candidate pairs caused by UTF-16 length/slice differences

### Added

- document pipeline `beforeExtractText` and `afterExtractKeywords` hooks
- stable serialization helpers for document keyword results plus serialized-byte estimation
- broader property coverage for Unicode, emoji, CJK, long-document, and dedup/similarity invariants
- Python-backed differential fuzz coverage for mutated fixture texts
- lightweight heap-delta reporting in benchmark scripts

### Notes

- Yaket now passes the Bobbin YAKE, topic-extractor, topic-system, and extraction-quality tests in the Bobbin reference checkout when wired in through the Bobbin adapter
- the remaining tracked multilingual parity gap is the Portuguese ranking drift captured in upstream `test_n3_PT`
- preserving original keyword case is intentional behavior in Yaket, even where upstream YAKE lowercases output in some no-dedup paths

## 0.4.0 - 2026-04-16

Extensibility, documentation, and benchmark expansion release.

### Added

- first-class `singleWordScorer` and `multiWordScorer` hooks for replacing the internal YAKE scoring formulas
- canonical `YakeOptions` and `YakeResult` public aliases
- short `extract()` helper as a concise alias for `extractKeywords()`
- richer stopword controls via `STOPWORDS`, `bundledStopwordTexts`, `createStopwordSet()`, and `createStaticStopwordProvider()`
- API reference, use-case guide, algorithm-drift guide, and contribution guide
- interactive browser demo and GitHub Pages workflow
- Inspec and SemEval benchmark script and benchmark report support
- red-green tests for scorer hooks, option precedence, and representative `seqm` parity examples

### Changed

- canonical option precedence now favors `language`, `dedupLim`, `dedupFunc`, and `windowSize` while still accepting legacy aliases for compatibility
- documentation now reflects the expanded tuning surface and clearer separation between current capabilities and deferred work

### Notes

- the remaining largest parity risks are still tokenizer drift from upstream `segtok` behavior and edge-case `seqm` heuristics
- broader Unicode/CJK/emoji fuzzing and broader multilingual verification remain intentionally deferred in `TODO.md`

## 0.3.0 - 2026-04-16

Stability and release-quality update.

### Changed

- aligned the direct `esbuild` dependency with the current Vitest/Vite toolchain
- refreshed and corrected the lockfile so `npm ci` works reliably in GitHub Actions
- relaxed golden fixture score comparisons to tolerate tiny cross-platform floating-point differences while keeping keyword order and metadata exact
- improved verification confidence across GitHub Actions, package validation, and release publishing

### Fixed

- GitHub Actions install failures caused by `package.json` and `package-lock.json` drift
- cross-platform CI failures caused by exact floating-point equality in golden fixture tests
- release flow inconsistencies between GitHub and npm package metadata

## 0.2.0 - 2026-04-16

Release alignment update for GitHub and npm readiness.

### Changed

- bumped the project version from `0.1.0` to `0.2.0`
- added npm-facing package metadata for repository, homepage, bugs, engines, and publish config
- published the package on npm as `@ade_oshineye/yaket`
- tightened installation and documentation wording so it matches the scoped npm package

### Notes

- GitHub releases and package metadata now align on `0.2.0`

## 0.1.0 - 2026-04-16

Initial public release.

### Added

- YAKE-compatible TypeScript core extraction pipeline with `KeywordExtractor`, `DataCore`, `SingleWord`, and `ComposedWord`
- bundled stopwords and JS-native tokenization/sentence-splitting utilities
- Bobbin-compatible adapter output and document-oriented pipeline helpers
- optional hooks for text processing, normalization, similarity, scoring, and filtering
- CLI, text highlighting, cache diagnostics, and Cloudflare Worker runtime coverage
- Python parity tests, golden fixtures, property-based tests, benchmark harness, and package validation
- architecture, integration, audit, and benchmark documentation

### Notes

- The current biggest parity risks remain `seqm` similarity behavior and tokenizer drift from Python YAKE's `segtok`-based flow.
- Deferred work is tracked in `TODO.md`.
