# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

Parity, ordering, and documentation consistency update.

### Changed

- clarified that `keyword` preserves source-text surface case while `normalizedKeyword` remains the normalized comparison key
- updated README, API reference, algorithm-drift notes, and TODO tracking so the current parity position is described consistently
- kept lemmatization hook-only by design and documented unsupported upstream-style string backend selectors more clearly

### Fixed

- sentence splitting drift that incorrectly merged sentences when the next sentence started with a lowercase token
- near-tie ordering for adjacent sliding 3-gram candidates such as `Kaggle data science` vs `Google Kaggle data`
- documentation drift around known ordering issues, which are now fixed for the tracked English parity cases
- tokenizer drift around abbreviation tokens, ellipses, and parenthetical sentence endings
- Bobbin adapter leakage where unigram components of stronger multi-word entity phrases could survive into Bobbin topic extraction

### Added

- document pipeline `beforeExtractText` and `afterExtractKeywords` hooks
- stable serialization helpers for document keyword results plus serialized-byte estimation
- broader property coverage for Unicode, emoji, CJK, long-document, and dedup/similarity invariants
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
