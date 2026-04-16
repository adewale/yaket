# Yaket Roadmap

This document captures the next work needed to:

- match more of the upstream Python YAKE functionality
- make Yaket more pluggable and idiomatic for TypeScript users
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

1. Publish ESM+CJS compatibility if there is downstream demand.
2. Add browser and worker-focused entry points if the project needs multi-runtime support.
3. Document language asset loading and custom stopword overrides more explicitly.

## Pluggable Architecture Plan

To make Yaket useful in ingestion pipelines, the implementation should evolve from a direct port into a typed, composable pipeline without losing the default YAKE behavior.

### Design goals

1. Keep the default path zero-config and faithful to YAKE.
2. Make extension points explicit instead of forcing forks.
3. Prefer typed interfaces and pure transformations over implicit global state.
4. Keep the public API idiomatic for TypeScript users.

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

### Ingestion pipeline integration

To fit common data pipelines, add adapters around the core extractor rather than baking ingestion logic into it.

1. `extractFromDocument(document)` helpers where `document` includes `id`, `language`, `title`, `body`, and metadata.
2. Batch helpers for arrays and async iterables.
3. Backpressure-friendly async APIs for stream ingestion.
4. Hook points for pre-normalization and post-ranking enrichment.
5. First-class support for deterministic serialization of outputs so they can be cached or diffed in ETL runs.

### Internal refactors that support this

1. Separate tokenization, candidate generation, scoring, and deduplication into isolated modules with stable interfaces.
2. Keep `DataCore` focused on document state, not policy decisions.
3. Remove hidden singleton-like behavior from caches and move them behind configurable cache objects.
4. Introduce explicit option types instead of mixed alias handling once the public API stabilizes.

## Testing And Verification Plan

This plan follows the strongest patterns from `adewale/testing-best-practices/research`.

### Principles to follow

1. Prefer real objects and real fixtures over hand-written mocks.
2. Use public interfaces for tests.
3. Add regression tests for every discovered mismatch.
4. Keep outputs deterministic and reviewable.
5. Use differential testing aggressively because a Python reference implementation exists.

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

#### 7. Documentation-code sync tests

Following the documentation sync pattern in `DECISION_TREE.md`:

1. verify README examples compile
2. verify documented public exports exist
3. verify roadmap feature status stays aligned with package capabilities

#### 8. Mutation testing for test-quality audits

Following `NOVEL_TESTING_TYPES.md` and the anti-pattern guidance:

1. run `Stryker` periodically on the scoring and dedup modules
2. use survived mutants to find weak assertions
3. prioritize critical algorithm modules rather than mutating the whole repo initially

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

### Evaluation method

1. Run upstream Python YAKE on the same episode and treat it as the behavioral reference.
2. Run Yaket.
3. Run TF-IDF baseline.
4. Produce a benchmark report containing:
   - the three ranked outputs
   - score normalization notes
   - overlap metrics
   - timing numbers
   - a short qualitative analysis

### Success criteria

Yaket should:

1. match or exceed TF-IDF on qualitative relevance
2. remain close to upstream Python YAKE ordering for the same text
3. keep runtime within a practical ingestion-pipeline budget

## Delivery Sequence

Recommended implementation order:

1. expand fixture corpus and Python differential testing
2. refactor tokenizer and similarity strategies behind interfaces
3. add `fast-check` property tests
4. add mutation-based fuzz tests
5. add packaging and docs sync tests
6. add CLI and highlighter
7. add benchmark harness and Komoroske TF-IDF comparison
8. evaluate optional lemmatization hooks

## Suggested Deliverables

1. `docs/roadmap.md` kept current as scope evolves
2. `test/fixtures/` corpus with reviewed baselines
3. `scripts/benchmark.ts` for Yaket vs TF-IDF vs Python YAKE
4. CI jobs for unit, fixture, differential, and packaging tests
5. benchmark report checked into `docs/benchmarks/`
