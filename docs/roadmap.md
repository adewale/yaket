# Yaket Roadmap

This document captures the next work needed to:

- match more of the upstream Python YAKE functionality
- make Yaket more pluggable and idiomatic for TypeScript users
- keep Yaket 100% compatible with Cloudflare's edge/runtime constraints
- make Yaket adoptable by Bobbin without destabilizing Bobbin's current topic system
- keep Yaket generic enough to be reused by future consumers such as `flux-search`
- deepen testing and verification
- benchmark Yaket against a TF-IDF baseline on the Komoroske dataset

## Current Baseline

Yaket already includes the core YAKE pipeline:

- `KeywordExtractor`
- `DataCore`
- `SingleWord`
- `ComposedWord`
- stopword-backed candidate generation and scoring
- dedup helpers and deterministic ordering
- bundled stopwords
- regression fixtures plus Python differential tests on frozen samples

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
2. Tighten tokenization and sentence splitting until behavior is closer to `segtok` across:
   - abbreviations and honorifics
   - contractions
   - Unicode punctuation
   - mixed alphanumeric tokens
   - quoted text and parentheticals
3. Replace the current approximate `seqm` implementation with a closer port of the Python similarity semantics.
4. Add more parity checks for near-tie ranking stability and floating-point tolerance handling.
5. Expand multilingual validation beyond the current smoke/regression cases.

### Tier 2: Missing upstream features

1. Add CLI support.
2. Port text highlighting.
3. Add optional lemmatization hooks.
4. Add cache statistics and related diagnostics if they remain useful in the TS API.
5. Port any remaining public utility APIs that downstream users would reasonably expect from YAKE.

### Tier 3: Packaging and runtime completeness

1. Treat Cloudflare Worker compatibility as a release gate, not as a later enhancement.
2. Ensure the extraction path requires no Node-only runtime APIs such as `fs`, `path`, `child_process`, native addons, or process-dependent asset loading.
3. Add browser and worker-focused entry points if the project needs multi-runtime support.
4. Publish ESM+CJS compatibility if there is downstream demand, but never at the expense of Worker safety.
5. Document language asset loading and custom stopword overrides more explicitly.

### Tier 4: Bobbin adoption and safe reuse

1. Add a Bobbin compatibility wrapper for the current `extractYakeKeywords(text, n?, maxNgram?)` calling convention.
2. Keep Bobbin integration incremental so `topic-extractor.ts` can adopt Yaket without a large rewrite.
3. Add a migration path that preserves Bobbin's current topic-layer responsibilities:
   - entity detection
   - topic normalization
   - noise filtering
   - topic merge policy
4. Add a second adoption track for generic consumers such as `flux-search` so Yaket does not assume a topic system exists.
5. Document which APIs are extraction-core APIs versus adoption-layer adapters.

## Pluggable Architecture Plan

To make Yaket useful in ingestion pipelines, the implementation should evolve from a direct port into a typed, composable pipeline without losing the default YAKE behavior.

### Design goals

1. Keep the default path zero-config and faithful to YAKE.
2. Make extension points explicit instead of forcing forks.
3. Prefer typed interfaces and pure transformations over implicit global state.
4. Keep the public API idiomatic for TypeScript users.
5. Keep the extraction core runtime-portable across Node, browsers, and Cloudflare Workers.
6. Avoid coupling the extraction core to Bobbin's topic model so future consumers can adopt Yaket independently.

### Proposed interfaces

Introduce a small set of strategy interfaces around the existing core:

1. `SentenceSplitter`
   - `split(text: string): string[]`
2. `Tokenizer`
   - `tokenize(sentence: string): string[]`
3. `StopwordProvider`
   - `load(language: string): Set<string>`
4. `CandidateNormalizer`
   - lowercasing, plural normalization, punctuation handling
5. `SimilarityStrategy`
   - `compare(a: string, b: string): number`
6. `KeywordScorer`
   - default YAKE scorer plus optional alternates for experiments
7. `CandidateFilter`
   - boundary, stopword, and tag filtering as replaceable policies

### Recommended API shape

1. Keep `new KeywordExtractor(options)` as the main API.
2. Add `createKeywordExtractor({ ...strategies })` for composition-heavy users.
3. Add a pure function `extractKeywords(text, options)` for one-shot use.
4. Add a richer result type:

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

5. Keep metadata optional so the simple API stays lightweight.

### Adoption layers

To stay useful for Bobbin without overfitting to Bobbin, the plan should explicitly separate core APIs from consumer adapters.

1. Core library layer
   - `KeywordExtractor`
   - `extractKeywords`
   - strategy interfaces
   - stopword and tokenization utilities
2. Consumer adapter layer
   - `createBobbinKeywordAdapter()` or equivalent example wrapper
   - document-oriented helpers for pipeline consumers
   - optional presets for Worker-safe defaults
3. Documentation layer
   - Bobbin integration guide
   - generic ingestion pipeline guide
   - future `flux-search` usage guidance built around documents and metadata, not topics

The key rule is that Bobbin should consume Yaket through a thin adapter, while the extractor core remains generic enough for reuse in systems that only need keyword extraction.

### Ingestion pipeline integration

To fit common data pipelines, add adapters around the core extractor rather than baking ingestion logic into it.

1. `extractFromDocument(document)` helpers where `document` includes `id`, `language`, `title`, `body`, and metadata.
2. Batch helpers for arrays and async iterables.
3. Backpressure-friendly async APIs for stream ingestion.
4. Hook points for pre-normalization and post-ranking enrichment.
5. First-class support for deterministic serialization of outputs so they can be cached or diffed in ETL runs.

### Bobbin-specific adoption plan

The roadmap should include a concrete Bobbin adoption track.

1. Preserve Bobbin's current call shape and result shape during migration.
2. Add Yaket-backed drop-in helpers that can replace the current `src/services/yake.ts` behavior behind the same interface.
3. Validate Yaket through Bobbin's existing topic tests before changing the default implementation.
4. Keep Bobbin's higher-level heuristics outside Yaket:
   - entity promotion
   - topic taxonomy
   - topic noise filtering
   - topic scoring merges
5. Do not move Bobbin-specific newsletter heuristics into Yaket core.

### Future-consumer plan

The roadmap should also include a non-Bobbin reuse track so Yaket does not corrupt surrounding projects.

1. Document Yaket as a standalone keyword extractor that can be used without any topic system.
2. Provide document-centric examples that fit search/indexing systems such as `flux-search`.
3. Avoid requiring entity extraction, taxonomy layers, or corpus stats in the main API.
4. Keep optional adapters additive so future projects can adopt Yaket without pulling in Bobbin assumptions.

### Internal refactors that support this

1. Separate tokenization, candidate generation, scoring, and deduplication into isolated modules with stable interfaces.
2. Keep `DataCore` focused on document state, not policy decisions.
3. Remove hidden singleton-like behavior from caches and move them behind configurable cache objects.
4. Introduce explicit option types instead of mixed alias handling once the public API stabilizes.
5. Move any future Bobbin-specific glue into dedicated adapter modules, never into the extraction core.

## Testing And Verification Plan

This plan follows the strongest patterns from `adewale/testing-best-practices/research`.

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

This should become a standard CI job, not just a local optional test.

#### 4. Property-based tests

Following `LESSONS_FROM_ADEWALE_REPOS.md`, `LESSONS_FROM_NPRYCE.md`, and `DECISION_TREE.md`, add `fast-check` properties for:

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

Because Worker compatibility is a hard requirement, add explicit runtime checks for it.

1. smoke test Yaket inside a Cloudflare Worker-style runtime
2. verify there are no runtime filesystem reads
3. verify the default extraction path does not depend on Node built-ins
4. verify bundled stopwords and assets work under Worker constraints
5. add bundle-size awareness if Yaket is going to ship into edge workloads repeatedly

#### 8. Documentation-code sync tests

Following the documentation sync pattern in `DECISION_TREE.md`:

1. verify README examples compile
2. verify documented public exports exist
3. verify roadmap feature status stays aligned with package capabilities
4. verify Bobbin integration examples stay current
5. verify generic pipeline examples stay current

#### 9. Mutation testing for test-quality audits

Following `NOVEL_TESTING_TYPES.md` and the anti-pattern guidance:

1. run `Stryker` periodically on the scoring and dedup modules
2. use survived mutants to find weak assertions
3. prioritize critical algorithm modules rather than mutating the whole repo initially

#### 10. Bobbin adoption tests

Bobbin should be a first-class integration target in the roadmap.

1. run Yaket through Bobbin's existing `extractTopics`-level tests
2. add explicit compatibility tests for Bobbin's current YAKE wrapper shape
3. compare topic outputs on Bobbin-style newsletter/article text
4. add regression tests for any Bobbin-specific ranking or filtering bugs discovered during adoption

#### 11. Future-consumer tests

To avoid overfitting Yaket to Bobbin, add tests that exercise Yaket in a generic document pipeline shape.

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

## Benchmark Plan: Yaket vs TF-IDF On Komoroske

The benchmark should compare Yaket against a straightforward TF-IDF baseline on one episode from the Komoroske dataset.

### Goal

Measure whether Yaket produces more useful top keywords than a simpler statistical baseline while preserving acceptable runtime.

Because Bobbin is the first adopter, the benchmark plan should also prove that Yaket is a practical replacement for Bobbin's current YAKE-like implementation without reducing topic quality.

### Dataset slice

1. Select one episode transcript from the Komoroske dataset.
2. Record the exact episode identifier in the benchmark fixture.
3. Preserve the raw source text and any normalization step so runs are reproducible.

### Baseline definition

Implement a simple, explicit TF-IDF baseline in TypeScript.

Recommended baseline setup:

1. tokenize using the same sentence/token normalization used by Yaket where practical
2. generate candidate n-grams up to the same `n`
3. remove stopwords using the same stopword set
4. compute TF-IDF scores over the Komoroske corpus if multiple documents are available

If only one episode is available locally, use transcript chunks as pseudo-documents and label that benchmark as provisional.

### Metrics

Compare both systems on:

1. top-10 keyword list
2. top-20 keyword list
3. overlap with upstream Python YAKE top-k
4. qualitative relevance review against the episode title, description, and transcript themes
5. runtime per extraction
6. peak memory or rough heap growth if practical

For adoption decisions, also compare:

1. current Bobbin `extractYakeKeywords`
2. Yaket
3. TF-IDF baseline
4. upstream Python YAKE

### Evaluation method

1. Run upstream Python YAKE on the same episode and treat it as the behavioral reference.
2. Run Yaket.
3. Run the current Bobbin implementation.
4. Run TF-IDF baseline.
5. Produce a benchmark report containing:
   - the four ranked outputs
   - score normalization notes
   - overlap metrics
   - timing numbers
   - a short qualitative analysis

### Success criteria

Yaket should:

1. match or exceed TF-IDF on qualitative relevance
2. remain close to upstream Python YAKE ordering for the same text
3. keep runtime within a practical ingestion-pipeline budget
4. not materially degrade Bobbin-style downstream topic quality

## Delivery Sequence

Recommended implementation order:

1. add Cloudflare Worker compatibility tests and make them pass
2. expand fixture corpus and Python differential testing
3. refactor tokenizer and similarity strategies behind interfaces
4. add Bobbin compatibility wrapper and Bobbin integration tests
5. add `fast-check` property tests
6. add mutation-based fuzz tests
7. add packaging and docs sync tests
8. add Bobbin and generic ingestion-pipeline integration documentation
9. add benchmark harness for Komoroske plus Bobbin current implementation and TF-IDF comparison
10. add CLI and highlighter
11. evaluate optional lemmatization hooks

## Suggested Deliverables

1. `docs/roadmap.md` kept current as scope evolves
2. `test/fixtures/` corpus with reviewed baselines
3. `docs/integrations/bobbin.md` or equivalent section documenting Bobbin adoption
4. `docs/integrations/pipelines.md` or equivalent section documenting generic ingestion-pipeline adoption
5. `scripts/benchmark.ts` for Yaket vs TF-IDF vs Python YAKE vs current Bobbin implementation
6. CI jobs for unit, fixture, differential, Worker compatibility, and packaging tests
7. benchmark report checked into `docs/benchmarks/`
