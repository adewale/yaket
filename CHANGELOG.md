# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 0.6.1 - 2026-04-29

Release hardening and dependency refresh.

### Changed

- Updated development dependencies across Vitest, Cloudflare Workers tooling,
  Stryker, tsx, publint, fast-check, and Wrangler within the supported Node 20
  toolchain.
- Release automation now follows an npm-first manual model: GitHub Actions
  validates release tags only, while `npm run release:manual -- X.Y.Z`
  publishes npm before pushing the tag or creating the GitHub release.
- Benchmark scripts write to stdout by default; tracked benchmark reports are
  refreshed only via explicit `benchmark:write` scripts, which require Python
  YAKE reference output.

### Fixed

- `DataCore` now defaults direct usage to `windowSize: 1`, matching
  `KeywordExtractor` and the public docs. Shared public defaults now live in
  `DEFAULT_YAKE_OPTIONS`.
- Similarity cache keys no longer embed a literal NUL byte in `src/similarity.ts`,
  so text tooling no longer treats the file as binary.

## 0.6.0 - 2026-04-25

Multilingual parity, alias removal, and pluggable internals.

See `docs/migration-bobbin-0.6.md` for the migration recipe.

### Breaking

- The snake_case option aliases on `KeywordExtractorOptions` are removed:
  `lan`, `dedup_lim`, `dedup_func`, `windowsSize`, `window_size`. Use
  `language`, `dedupLim`, `dedupFunc`, and `windowSize`. Passing the old
  names — even via plain JS, JSON, or class prototypes — now throws a
  `TypeError` instead of silently falling back to defaults.
- The `extract_keywords()` Python-style method on `KeywordExtractor` is
  removed. Use `extractKeywords()` (or the standalone `extract()` /
  `extractKeywords()` helpers).
- The dedup-function value aliases (`leve`, `jaro_winkler`,
  `sequencematcher`) are removed. `dedupFunc` and `--dedup-func` now
  accept exactly `seqm`, `levs`, or `jaro` and throw a `TypeError` on
  anything else, naming the bad value and the accepted set.
- `KeywordExtractor.config.lan` was renamed to `.language`.
- `DataCore({ windowsSize })` was renamed to `DataCore({ windowSize })`.

### Added

- Multilingual head-parity locks against upstream Python YAKE 0.7.x for
  `pt`, `de`, `es`, `it`, `fr`, `nl`, `ru`, and `ar`. Two test layers:
  single-paragraph (`test/multilingual-parity.test.ts`) and a 21-document
  multi-language corpus (`test/multilingual-corpus.test.ts`, 168/210
  head slots locked).
- Per-language Yaket-vs-Python parity benchmark
  (`npm run benchmark:multilingual`, report at
  `docs/benchmarks/multilingual.md`).
- `sentenceSplitter` and `tokenizer` options on `KeywordExtractorOptions`
  so the `SentenceSplitter` and `Tokenizer` interfaces can be supplied
  independently of the combined `TextProcessor`.
- `createSimilarityCache({ maxSize? })` factory returning a typed
  `SimilarityCache` with `stats()`, `clear()`, and bounded `distance`,
  `ratio`, `sequence`, and `jaro` maps. All four similarity helpers
  (`Levenshtein.distance`, `Levenshtein.ratio`, `sequenceSimilarity`,
  `jaroSimilarity`) accept the cache as an optional final argument and
  memoize their results inside it.
- `similarityCache` option on `KeywordExtractor` for isolating cache
  state per worker / per request / per benchmark.
- `extractFromDocument`, `extractFromDocuments`, and
  `extractFromDocumentStream` document the same language-precedence
  rule (`options.language ?? document.language ?? "en"`).
- ASCII architecture diagram alongside the Mermaid one in
  `docs/architecture.md`.
- Bundle-size guardrail: `npm run bundle-size` writes
  `docs/benchmarks/bundle-size.md`; `test/bundle-size.test.ts` asserts
  the worker-target ESM bundle stays inside a 64 KiB gzipped budget and
  contains no Node built-ins.
- Mutation-testing baseline at 68.77 % captured in
  `docs/audits/mutation-testing-2026-04-26.md`. `npm run test:mutation`
  finishes in ~8 minutes thanks to `coverageAnalysis: "perTest"`.
- Migration guide at `docs/migration-bobbin-0.6.md`.
- Lemmatization evaluation at `docs/lemmatization-evaluation.md`.

### Changed

- `dedupFunc` rejects unknown values with a clear `TypeError` instead of
  silently aliasing them to a default.
- `createSimilarityCache({ maxSize })` validates that `maxSize` is a
  positive integer; `0`, negatives, `NaN`, `Infinity`, and non-integers
  throw a `RangeError`.
- The bundle-leak guard now uses esbuild's import graph (the metafile)
  plus a regex pass over the bundle text for literal-prefix
  `import("node:*")` / `require("node:*")` calls. A shared list of
  forbidden built-ins powers both the `bundle-size` script and its test.
- `npm run typecheck` covers `src/`, `scripts/`, and `test/` — the
  build `tsconfig.json` plus a new `tsconfig.tooling.json`.

### Fixed

- Portuguese ranking drift in upstream `test_n3_PT`. The tokenizer now
  matches segtok behavior when a sentence closer is the last token of
  the input (`Histórias."` → `[Histórias, ., "]`). Yaket exact-matches
  the upstream YAKE 9-element prefix for `test_n3_PT` and 10/10 head
  parity on the multilingual paragraphs for de/fr/it/pt/nl/ru.
- Document-pipeline language precedence is now consistent across
  `extractFromDocument`, `extractFromDocuments`, and
  `extractFromDocumentStream`. The explicit option wins everywhere
  (previously batch/stream let `document.language` win while
  single-document let `options.language` win).
- Document hook contexts (`beforeExtractText`, `afterExtractKeywords`)
  report the same language the underlying extractor used. Previously
  the batch/stream cache could build the extractor with one language
  while the hooks saw another.

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
