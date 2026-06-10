# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- `lemmaAggregation` option on `KeywordExtractor` for grouping the
  final ranked list by lemma and combining scores with one of `min`,
  `mean`, `max`, or `harmonic`. Matches upstream Python YAKE's
  `lemma_aggregation` behavior. Requires a `lemmatizer` hook; setting
  `lemmaAggregation` without one is rejected at the public boundary
  with a `TypeError`. When `lemmaAggregation` is set the lemmatizer is
  reserved for the post-ranking grouping step so distinct surface
  forms survive long enough to be grouped explicitly.
- New `aggregateKeywordsByLemma`, `LEMMA_AGGREGATION_NAMES`, and
  `LemmaAggregationName` exports.
- New `test/graph.test.ts` covering `DirectedGraph` directly (in-/out-
  degree symmetry, weight accumulation, decrement, auto-create).
- New `test/data-core.test.ts` pinning `DataCore` direct-construction
  behavior: shared defaults, term-index plural-trim and stopword
  marking, document statistics, and window-skip co-occurrence semantics
  validated against upstream Python YAKE.
- `SimilarityCache` eviction is now genuinely least-recently-used:
  every cache hit refreshes the entry's recency, so hot keys are no
  longer evicted before colder, later-inserted ones. Previously the
  documented "LRU" behavior was first-in-first-out.
- New `src/numerics.ts` ports numpy's unrolled 8-accumulator pairwise
  summation kernel. `DataCore.buildSingleTermsFeatures` now uses it
  for `avgTf` and the sum-of-squared-deltas inside `stdTf`, closing the
  3-ULP drift the naive accumulator introduced against upstream
  Python YAKE on the Portuguese parity sample. New `test/numerics.test.ts`
  pins the kernel against numpy-captured reference values on inputs
  that exercise the naive, unrolled, and recursive-split paths.
- New audit doc at
  `docs/audits/architecture-algorithms-data-structures-and-tests-2026-06-10.md`.

### Changed

- `test/multilingual-parity.test.ts` fixtures gained a `tiedBuckets`
  field that asserts set equality on position ranges where Yaket and
  upstream return the same candidates in different order because the
  candidates score byte-identically inside Yaket's float math. The
  Arabic fixture now pins the full top-12 with positions 3-5 declared
  as a tied bucket — the parity guarantee Yaket actually delivers
  (same candidates at those positions, ordering within the tie is
  implementation-defined). Closes TODO #2 (V8 vs glibc `Math.log`
  residual) as a test-design fix rather than a hot-path log port.
- `splitSentences` now applies segtok's `_abbreviation_joiner` join
  rule: when a sentence-terminal (`.`, `!`, `?`) is preceded by
  whitespace, the terminal is stray punctuation and does not split.
  This lifts the Portuguese parity head from 9/9 to 16/16 candidates
  (TODO #7). Six new regression tests in
  `test/tokenizer-parity.test.ts` cover the rule and the
  `Arquivo.pt . Nesta plataforma` reference span.
- `compareCandidates` no longer reverses insertion order for sliding-
  trigram ties. The reversal was a heuristic that helped one synthetic
  four-word example but regressed three multilingual parity samples.
  Removing it lifts Spanish from 9/10 to a full 12/12 match with
  upstream and brings the Portuguese 10/11 swap into the
  upstream-correct order. `isSlidingNgramTie` is no longer exported.
- Stryker mutation testing now includes `src/config.ts`, `src/graph.ts`,
  `src/lemma.ts`, and `src/numerics.ts` in addition to the scoring and
  dedup modules. The `mutation` CI job now runs on a weekly cron
  (`0 6 * * 0`) in addition to `workflow_dispatch`, so survivors cannot
  pile up between manual runs (TODO #4).
- ESLint config now ignores the transient `.stryker-tmp/**` sandbox so
  `npm run verify` does not break when a Stryker run was interrupted.
- `docs/integrations/bobbin.md` now documents the three-layer Bobbin
  re-validation cadence (per-push adapter shape, per-push golden,
  Bobbin-side topic suite on releases — TODO #6).

### Fixed

- `tokenizeWords` was attaching a trailing period to dotted tokens like
  `Arquivo.pt` even when the source had whitespace between the token
  and the period. The tokenizer now uses regex-match positions to
  preserve segtok's "only attach when glued" behavior. This lifts the
  Portuguese mid-rank `Arquivo.pt` candidate back into the top-12
  (Python YAKE has it at 13).
- Portuguese top-20 now matches upstream Python YAKE by candidate name
  for every position. Residual 1-ULP score drift is bounded by V8 vs
  glibc `Math.log` precision and stays below the comparator's tie-break
  tolerance.
- Bobbin newsletter golden scores are now bit-exact against upstream
  Python YAKE thanks to the pairwise summation port.

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
- Started the correctness-by-construction refactor with `parseYakeOptions()` /
  `YakeConfig`, candidate-construction tests, and a local `benchmark:core`
  with phase timings.

### Fixed

- `DataCore` now defaults direct usage to `windowSize: 1`, matching
  `KeywordExtractor` and the public docs. Shared public defaults now live in
  `DEFAULT_YAKE_OPTIONS`.
- Similarity cache keys no longer embed a literal NUL byte in `src/similarity.ts`,
  so text tooling no longer treats the file as binary.
- Invalid raw candidates no longer produce an empty `ComposedWord` sentinel;
  `tryBuildCandidate()` returns `null` and `buildCandidate()` throws.

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
