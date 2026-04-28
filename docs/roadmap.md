# Yaket Roadmap

This document captures the next work needed to:

- match more of the upstream Python YAKE functionality
- make Yaket more pluggable and idiomatic for TypeScript users
- keep Yaket 100% compatible with Cloudflare's edge/runtime constraints
- make Yaket adoptable by Bobbin without destabilizing Bobbin's current topic system
- keep Yaket generic enough to be reused by future consumers such as `flux-search`
- deepen testing and verification
- benchmark Yaket against a TF-IDF baseline on the Komoroske dataset

Deferred work that is intentionally not part of the current implementation tranche is tracked in `TODO.md`.

## Current Baseline

Yaket already includes the core YAKE pipeline:

- `KeywordExtractor`
- `DataCore`
- `SingleWord`
- `ComposedWord`
- stopword-backed candidate generation and scoring across 34 bundled languages
- dedup helpers and deterministic ordering
- bundled stopwords
- regression fixtures plus Python differential tests on frozen samples
- multilingual head-parity locks against upstream YAKE 0.7.x for `pt`, `de`, `es`, `it`, `fr`, `nl`, `ru`, `ar` (`test/multilingual-parity.test.ts`)
- per-language Yaket-vs-Python benchmark and report (`scripts/benchmark-multilingual.ts`, `docs/benchmarks/multilingual.md`)
- broader property coverage for Unicode, emoji, CJK, long-document, dedup, and multilingual invariants
- pluggable hooks for text processing, normalization, similarity, scoring, and filtering, including independent `SentenceSplitter` and `Tokenizer` overrides
- configurable bounded similarity caches via `createSimilarityCache({ maxSize? })` and the `similarityCache` extractor option
- canonical-only options surface (0.6 dropped the `lan`/`dedup_lim`/`dedup_func`/`windowsSize`/`window_size` aliases, the `extract_keywords()` method, and the dedup-function value aliases)
- Bobbin-compatible adapter output
- document-oriented extraction helpers for ingestion pipelines, including pre/post hooks and stable serialization helpers
- CLI support
- text highlighting support
- optional lemmatization hooks
- Cloudflare Worker runtime verification, package checks, and benchmark tooling

The current implementation is materially closer to upstream Python YAKE than the original `bobbin` implementation and intentionally does not follow the modified ranking behavior in `quesurifn/yake-wasm`.

## Adoption Constraints

These constraints are now part of the plan, not optional nice-to-haves.

### Hard requirements

1. Yaket must remain 100% compatible with Cloudflare's edge/runtime environment.
2. Yaket must include documentation showing how an ingestion pipeline like Bobbin can plug it in.
3. Yaket must not become so Bobbin-specific that it cannot be reused elsewhere.
4. Yaket must remain usable by future consumers such as `flux-search`, even if they do not have Bobbin's topic-extraction stack.

### Implications

1. Bobbin is the first adopter, not the only adopter.
2. Bobbin-specific integration logic should live in adapters, presets, or examples rather than inside the extraction core.
3. Public APIs should be typed around documents, keywords, and strategies, not around Bobbin's topic model.
4. Any runtime decision that would break on Cloudflare Workers is disallowed by default.

## Parity Enhancements

These are the highest-value enhancements needed to match upstream Python YAKE more completely.

### Tier 1: Core behavior fidelity

1. Port more of the upstream corpus into fixture tests.
2. Continue expanding parity checks for floating-point tolerance handling and multilingual ranking stability.
   Note: tracked `seqm` differential parity, harder Unicode punctuation/tokenizer cases, and the English near-tie ordering regressions are now covered by regression tests.
3. Multilingual validation: head-parity locks against upstream Python YAKE 0.7.x are now in place for `pt`, `de`, `es`, `it`, `fr`, `nl`, `ru`, `ar` (`test/multilingual-parity.test.ts`). The headline tokenizer-driven Portuguese drift in upstream `test_n3_PT` has been closed (first 9 candidates exact-match upstream). Remaining drift items are tracked in `TODO.md` (mid-rank `seqm` dedup divergence, Arabic tie-break ordering when multiple candidates share byte-identical scores).

### Tier 2: Remaining upstream-facing feature gaps

1. Evaluate whether the current CLI needs closer parity with upstream ergonomics or richer publishing examples.
2. Compare the current `TextHighlighter` behavior against upstream and extend it only if concrete gaps matter to adopters.
3. Keep lemmatization hook-only unless a concrete consumer justifies bundled optional backends.
4. Keep cache statistics and related diagnostics aligned with actual API needs.
5. Port any remaining public utility APIs that downstream users would reasonably expect from YAKE.

### Tier 3: Packaging and runtime completeness

1. Keep Cloudflare Worker compatibility as a release gate, not a best-effort target.
2. Keep the extraction path free of Node-only runtime APIs such as `fs`, `path`, `child_process`, native addons, or process-dependent asset loading.
3. Revisit ESM+CJS compatibility only if downstream demand appears, and never at the expense of Worker safety.
4. Keep language asset loading and custom stopword override docs aligned with the real runtime behavior.

### Tier 4: Bobbin adoption and safe reuse

1. Keep the existing Bobbin compatibility wrapper for `extractYakeKeywords(text, n?, maxNgram?)` stable as adoption continues.
2. Keep Bobbin integration incremental so `topic-extractor.ts` can adopt Yaket without a large rewrite.
3. Add a migration path that preserves Bobbin's current topic-layer responsibilities:
   - entity detection
   - topic normalization
   - noise filtering
   - topic merge policy
4. Keep the existing generic-consumer adoption track healthy so Yaket does not assume a topic system exists.
5. Keep documentation clear about which APIs are extraction-core APIs versus adoption-layer adapters.

The remaining Bobbin work is to keep that integration validation current as Bobbin evolves.

## Pluggable Architecture Plan

Yaket already exposes a typed, composable pipeline surface. The remaining work here is to keep that surface coherent without losing the default YAKE behavior.

### Design goals

1. Keep the default path zero-config and faithful to YAKE.
2. Make extension points explicit instead of forcing forks.
3. Prefer typed interfaces and pure transformations over implicit global state.
4. Keep the public API idiomatic for TypeScript users.
5. Keep the extraction core runtime-portable across Node, browsers, and Cloudflare Workers.
6. Avoid coupling the extraction core to Bobbin's topic model so future consumers can adopt Yaket independently.

### Implemented interfaces and remaining gaps

Yaket already exposes most of the intended strategy surface around the existing core:

1. `TextProcessor`
   - covers sentence splitting and tokenization in one Worker-safe interface
2. `StopwordProvider`
   - `load(language: string): Set<string>`
3. `CandidateNormalizer`
   - lowercasing, plural normalization, punctuation handling
4. `SimilarityStrategy`
   - `compare(a: string, b: string): number`
5. `KeywordScorer`
     - default YAKE scorer plus optional alternates for experiments
6. `SingleWordScorer`
    - replaces the internal YAKE single-word score formula directly
7. `MultiWordScorer`
    - replaces the internal YAKE multi-word score formula directly
8. `CandidateFilter`
    - boundary, stopword, and tag filtering as replaceable policies

Status: `SentenceSplitter` and `Tokenizer` are exported and wired into `KeywordExtractor` as independent options (0.6). Either half can be overridden without supplying the combined `TextProcessor`. The combined `TextProcessor` interface remains for callers that want to override both halves at once.

### Recommended API shape

The current public shape already includes:

1. `new KeywordExtractor(options)` as the main API.
2. `createKeywordExtractor({ ...strategies })` for composition-heavy users.
3. pure functions `extract(text, options)` and `extractKeywords(text, options)` for one-shot use.
4. a richer result type:

```ts
interface KeywordResult {
  keyword: string;
  normalizedKeyword: string;
  score: number;
  ngramSize: number;
  occurrences?: number;
  sentenceIds?: number[];
}
```

5. metadata kept optional so the simple API stays lightweight.

Status (0.6): the alias-heavy option handling has been removed. `KeywordExtractorOptions` now equals `YakeOptions`. The constructor walks one `??` per field. Migration recipe lives in `docs/migration-bobbin-0.6.md`.

### Adoption layers

To stay useful for Bobbin without overfitting to Bobbin, Yaket already separates core APIs from consumer adapters.

1. Core library layer
    - `KeywordExtractor`
    - `extractKeywords`
    - strategy interfaces
    - stopword and tokenization utilities
2. Consumer adapter layer
    - `extractYakeKeywords()` for Bobbin-shaped extraction output
    - document-oriented helpers for pipeline consumers
    - Worker-safe default extraction path
3. Documentation layer
    - Bobbin integration guide
    - generic ingestion pipeline guide
    - future `flux-search` usage guidance built around documents and metadata, not topics

The key rule is that Bobbin should consume Yaket through a thin adapter, while the extractor core remains generic enough for reuse in systems that only need keyword extraction.

### Ingestion pipeline integration

Yaket already includes document-oriented adapters around the core extractor rather than baking ingestion logic into it.

1. `extractFromDocument(document)` helpers where `document` includes `id`, `language`, `title`, `body`, and metadata.
2. Batch helpers for arrays and async iterables.
3. Backpressure-friendly async APIs for stream ingestion.
4. Hook points for pre-normalization and post-ranking enrichment.
5. Stable serialization support so outputs can be cached or diffed in ETL runs.

Remaining follow-up: keep pipeline/runtime diagnostics proportional to real adopter needs.

### Bobbin-specific adoption plan

Bobbin remains a concrete adoption track for Yaket.

1. Preserve Bobbin's current call shape and result shape during migration.
2. Add Yaket-backed drop-in helpers that can replace the current `src/services/yake.ts` behavior behind the same interface.
3. Validate Yaket through Bobbin's existing topic tests before changing the default implementation.
4. Keep Bobbin's higher-level heuristics outside Yaket:
   - entity promotion
   - topic taxonomy
   - topic noise filtering
   - topic scoring merges
5. Do not move Bobbin-specific newsletter heuristics into Yaket core.

### Future-consumer track

Yaket already supports a non-Bobbin reuse track so it does not corrupt surrounding projects.

1. Document Yaket as a standalone keyword extractor that can be used without any topic system.
2. Provide document-centric examples that fit search/indexing systems such as `flux-search`.
3. Avoid requiring entity extraction, taxonomy layers, or corpus stats in the main API.
4. Keep optional adapters additive so future projects can adopt Yaket without pulling in Bobbin assumptions.

Remaining follow-up: keep these standalone and search/indexing-oriented examples current as new adopters arrive.

### Internal refactors that support this

1. Separate tokenization, candidate generation, scoring, and deduplication into isolated modules with stable interfaces. (Done — `src/utils.ts` for sentence/token logic, `src/DataCore.ts` for state and candidate generation, `src/SingleWord.ts` / `src/ComposedWord.ts` for scoring, `src/similarity.ts` for dedup.)
2. Keep `DataCore` focused on document state, not policy decisions.
3. Remove hidden singleton-like behavior from caches and move them behind configurable cache objects. (Done in 0.6 — `createSimilarityCache({ maxSize? })`, `KeywordExtractor#similarityCache`, helpers accept the cache as an optional final argument. Module-level default kept for back-compat.)
4. Introduce explicit option types instead of mixed alias handling once the public API stabilizes. (Done in 0.6 — see migration recipe.)
5. Move any future Bobbin-specific glue into dedicated adapter modules, never into the extraction core.

## Testing And Verification Plan

This plan follows the strongest patterns from `adewale/testing-best-practices/research`.

Much of this plan is already implemented. The remaining work is mostly about broadening corpus coverage, multilingual depth, Bobbin adoption validation, and mutation/property coverage.

### Principles to follow

1. Prefer real objects and real fixtures over hand-written mocks.
2. Use public interfaces for tests.
3. Add regression tests for every discovered mismatch.
4. Keep outputs deterministic and reviewable.
5. Use differential testing aggressively because a Python reference implementation exists.
6. Treat Cloudflare Worker compatibility as a tested behavior, not a documentation claim.
7. Test both the standalone extractor and adopter-facing integration paths.

### Test layers

#### 1. Required unit tests

Following `DECISION_TREE.md`, every non-trivial public behavior should have unit tests with explicit assertions for:

1. happy path behavior
2. edge cases
3. failure or empty-input cases

Target areas:

1. token tagging
2. stopword boundary filtering
3. candidate building
4. single-word scoring
5. multi-word scoring
6. dedup ordering
7. determinism across repeated runs

#### 2. Fixture-based golden tests

Following the `LESSONS_FROM_KEPANO.md` pattern:

1. Add `test/fixtures/input/` for raw texts.
2. Add `test/fixtures/expected/` for human-reviewable expected outputs.
3. Use auto-discovery so adding a fixture does not require editing the test file.
4. Store output as readable JSON or Markdown, not opaque binary snapshots.

Recommended fixture groups:

1. English news/article texts
2. multilingual excerpts
3. contractions and apostrophes
4. stopword-only inputs
5. repetitive long texts
6. abbreviations and punctuation edge cases

#### 3. Differential testing against Python YAKE

Following the `NOVEL_TESTING_TYPES.md` differential testing guidance:

1. Run Yaket and upstream Python YAKE on the same corpus.
2. Compare:
   - keyword order
   - score tolerance
   - top-k overlap
   - determinism over repeated runs
3. Treat every divergence as either:
   - a Yaket bug
   - an intentional documented deviation
   - an ambiguity requiring a regression fixture

This already exists as a checked-in verification path. Remaining work is broader corpus coverage and more multilingual differential checks.

#### 4. Property-based tests

Following `LESSONS_FROM_ADEWALE_REPOS.md`, `LESSONS_FROM_NPRYCE.md`, and `DECISION_TREE.md`, keep expanding `fast-check` properties around:

1. never throws on arbitrary Unicode text
2. deterministic repeated runs on the same input
3. valid-or-absent output for malformed inputs
4. stopword boundary invariant
5. monotonic top-k truncation behavior
6. no duplicate final keywords when dedup is enabled
7. normalized scores remain finite and positive

Useful invariants:

1. If `top = n`, result length is `<= n`.
2. Returned scores are sorted ascending.
3. Returned phrases are non-empty and trimmed.
4. With dedup disabled, output is a prefix of the fully ranked candidate list.

#### 5. Mutation-based fuzzing

Following `LESSONS_FROM_NPRYCE.md`:

1. Start from known-good corpus fixtures.
2. Mutate punctuation, Unicode, quotes, whitespace, digits, and contractions.
3. Assert the extractor does not crash.
4. Diff mutated-text results against Python to find tokenizer and ranking drift.

This is more useful here than pure random generation because keyword extraction is highly sensitive to plausible text structure.

#### 6. Smoke and packaging tests

Following `DECISION_TREE.md`:

1. package builds from a clean checkout
2. `npm pack --dry-run` contains built artifacts
3. package can be imported from Node ESM
4. documented examples compile and run

#### 7. Cloudflare Worker compatibility tests

Because Worker compatibility is a hard requirement, Yaket already includes explicit runtime checks for it.

1. smoke test Yaket inside a Cloudflare Worker-style runtime
2. verify there are no runtime filesystem reads
3. verify the default extraction path does not depend on Node built-ins
4. verify bundled stopwords and assets work under Worker constraints
5. remaining follow-up: add bundle-size awareness if Yaket is going to ship into edge workloads repeatedly

#### 8. Documentation-code sync tests

Yaket already includes documentation-code sync tests. Remaining work is to keep them broad enough as the API and docs evolve:

1. verify README examples compile
2. verify documented public exports exist
3. verify roadmap feature status stays aligned with package capabilities
4. verify Bobbin integration examples stay current
5. verify generic pipeline examples stay current

#### 9. Mutation testing for test-quality audits

Current support exists through `Stryker` configuration. Remaining work:

1. run `Stryker` periodically on the scoring and dedup modules
2. use survived mutants to find weak assertions
3. prioritize critical algorithm modules rather than mutating the whole repo initially

#### 10. Bobbin adoption tests

Bobbin remains a first-class integration target in the roadmap.

1. keep running Yaket through Bobbin's existing `extractTopics`-level tests as Bobbin evolves
2. keep explicit compatibility tests for Bobbin's current YAKE wrapper shape
3. compare topic outputs on Bobbin-style newsletter/article text
4. add regression tests for any Bobbin-specific ranking or filtering bugs discovered during adoption

#### 11. Future-consumer tests

To avoid overfitting Yaket to Bobbin, keep expanding tests that exercise Yaket in a generic document pipeline shape.

1. document-oriented extraction tests without topic taxonomy
2. indexing/search-oriented tests that validate stable keyword extraction from plain documents
3. contract tests around adapter boundaries so a future consumer like `flux-search` can integrate without Bobbin-specific assumptions

### Anti-patterns to avoid

From `ANTIPATTERNS.md`, explicitly avoid:

1. asserting only `result.length > 0`
2. logging instead of asserting
3. calling a test “integration” while mocking the real boundary
4. snapshotting unreadable output that no one reviews
5. letting docs drift away from the real API

## Benchmark Continuation

Yaket already includes benchmark scripts and checked-in reports for Komoroske, multilingual single-paragraph parity, and Inspec/SemEval dataset-oriented comparisons.

Remaining benchmark work:

1. expand the multilingual benchmark beyond a single representative paragraph per language to a multi-document corpus per language.
2. keep comparing Yaket against upstream Python YAKE, TF-IDF, and the Bobbin baseline on new corpora.
3. add more adoption-focused benchmark notes when Bobbin integration validation is run.
4. add explicit bundle-size reporting if edge adopters need it.

## Remaining Sequence

Recommended next implementation order:

1. expand fixture corpus and Python differential testing (English long-form, multilingual long-form).
2. deepen mutation-survival in scoring and dedup modules with periodic Stryker passes.
3. keep Bobbin integration validation current as Bobbin evolves.
4. investigate the residual mid-rank Portuguese `seqm` dedup divergence and the Arabic tie-break ordering captured in `TODO.md`.
5. evaluate whether a fuller optional lemmatization implementation is justified (see `docs/lemmatization-evaluation.md`).
6. add any remaining package/runtime hardening that real adopters need.

## Remaining Deliverables

1. broader reviewed fixture corpus, especially for multilingual and tokenizer-edge texts beyond the current per-language paragraph.
2. keep Bobbin repo integration validation current as Bobbin changes.
3. multi-document multilingual benchmark report.
4. stronger mutation/property coverage reporting for scoring and dedup modules.
