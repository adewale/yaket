# Correctness-by-Construction Refactor Spec

This spec describes how Yaket would be redesigned if the governing principle were:

> Defense-in-depth is an antipattern; prefer correctness by construction.

The goal is not to remove all validation. The goal is to move validation to narrow boundaries, parse once, and make invalid internal states unrepresentable or difficult to express.

## 1. Design Goals

1. Invalid release states should be impossible on the normal path.
2. Public option aliases, defaults, and validation should be resolved once at the API boundary.
3. Internal algorithm phases should consume fully parsed, canonical types.
4. Candidate, score, similarity, and document states should avoid nullable sentinels and partially initialized objects.
5. Benchmarks should be reproducible and should not mutate tracked documentation unless explicitly requested.
6. The refactor must preserve Python YAKE parity locks, browser/worker compatibility, and the gzip bundle budget.
7. Performance must be measured phase-by-phase and must not regress materially.

## 2. Non-Goals

1. Do not replace TypeScript with a runtime-heavy schema framework in hot paths.
2. Do not remove public runtime errors for invalid user input.
3. Do not rewrite the algorithm in one large change.
4. Do not prioritize theoretical purity over bundle size, edge compatibility, or parity.
5. Do not move npm credentials into GitHub Actions.

## 3. Target Architecture

Split the project into boundary modules and pure core modules.

```text
src/public/
  KeywordExtractor.ts      public class and helper functions
  cli.ts                   CLI parsing and error presentation
  document.ts              document pipeline and hooks

src/core/
  config.ts                parse public options into canonical config
  defaults.ts              one source of public defaults
  text.ts                  prefiltering and sentence splitting
  token.ts                 tokenization and token tags
  normalize.ts             lemmatization / candidate normalization boundary
  terms.ts                 term index construction
  graph.ts                 co-occurrence graph construction
  candidates.ts            candidate generation and validation
  score.ts                 single- and multi-word scoring
  dedup.ts                 deduplication policy
  similarity.ts            similarity algorithms and typed cache

src/reference/
  pythonParity.ts          reference-test helpers only
```

The current codebase can reach this incrementally. The directory split is aspirational until the relevant phase lands; before `src/core/` exists, apply the same rule to files or modules designated as core in that phase plan. The important constraint is that core modules must not accept raw public `YakeOptions`.

## 4. Typed Pipeline

The extraction pipeline should be represented as explicit phases:

```text
RawText
  -> PreprocessedText
  -> Sentence[]
  -> TokenizedSentence[]
  -> NormalizedToken[]
  -> TermIndex
  -> CooccurrenceGraph
  -> Candidate[]
  -> ScoredCandidate[]
  -> DedupedKeywordResult[]
```

Use TypeScript branded types for phase outputs:

```ts
type RawText = string & { readonly __brand: "RawText" };
type PreprocessedText = string & { readonly __brand: "PreprocessedText" };
type NormalizedToken = string & { readonly __brand: "NormalizedToken" };
type PositiveInt = number & { readonly __brand: "PositiveInt" };
type Similarity01 = number & { readonly __brand: "Similarity01" };
```

Brands are compile-time only. Do not introduce runtime wrapper objects in hot loops.

## 5. Configuration Correctness

Public options are parsed once:

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

function parseYakeOptions(options: YakeOptions): Result<YakeConfig, OptionError>;
```

Internal modules receive only `YakeConfig`:

```ts
interface YakeConfig {
  readonly language: string;
  readonly n: PositiveInt;
  readonly top: PositiveInt;
  readonly dedupLim: Similarity01;
  readonly dedupFunc: DedupFunctionName;
  readonly windowSize: PositiveInt;
  readonly features: FeatureSet;
}
```

Rules:

1. `YakeOptions` is public-boundary-only.
2. Defaults live in one exported constant: `DEFAULT_YAKE_OPTIONS`.
3. Deprecated aliases are rejected only at the public boundary.
4. Core code never performs defaulting with literals such as `?? 3` or `?? "en"`.
5. Public constructors may throw; core parsing helpers should use typed results where useful.

## 6. Candidate Correctness

The current sentinel style (`new ComposedWord(null)`) should be removed.

Target representation:

```ts
type CandidateBuildResult =
  | { readonly kind: "candidate"; readonly candidate: Candidate }
  | { readonly kind: "rejected"; readonly reason: CandidateRejectReason };
```

Or, in hot paths where rejected reasons are not needed:

```ts
function buildCandidate(input: CandidateInput): Candidate | null;
```

Rules:

1. A scored candidate must always have at least one real term.
2. Candidate n-gram size must be `1 <= size <= config.n`.
3. Candidate normalized form must be precomputed exactly once.
4. Stopword boundary rejection should occur before scoring.
5. Invalid candidates must not be represented as valid objects with empty fields.

## 7. State and Mutability

The current `DataCore` class mixes parsing, graph construction, candidate generation, feature preparation, and mutable state. Refactor it into smaller phase builders.

Preferred shape:

```ts
const document = parseDocumentText(text, config);
const termIndex = buildTermIndex(document, config);
const graph = buildCooccurrenceGraph(document, termIndex, config);
const candidates = buildCandidates(document, termIndex, config);
const scored = scoreCandidates(candidates, termIndex, graph, config);
const deduped = dedupeCandidates(scored, config);
```

Rules:

1. Public API may expose classes for compatibility.
2. Core phase functions should be pure where practical.
3. Hot data should use dense arrays and integer IDs rather than object graphs when this improves performance.
4. Mutable caches must have explicit ownership and bounded size.
5. Cache invalidation should be unnecessary by construction where possible.

## 8. Similarity Correctness

Similarity helpers should return typed values in `[0, 1]` where applicable.

Rules:

1. `Similarity01` construction happens inside similarity helpers.
2. Cache keys must not contain literal control characters in source text; use escaped constants.
3. Cache instances should be explicit for request/worker isolation.
4. The module-level default cache remains for backward compatibility but should not be used in core tests that need isolation.
5. Canonical fixtures should cover Jaro, Levenshtein, and representative `seqm` behavior.

## 9. Release Correctness

Yaket uses a manual npm-first release model.

Rules:

1. GitHub Actions validates tags but does not publish npm and does not create official GitHub releases.
2. npm credentials stay local or in a user-controlled password manager.
3. `npm run release:manual -- X.Y.Z` is the normal release path.
4. The release script must publish npm before pushing the git tag.
5. The GitHub release is created only after npm accepts the package.
6. Missing npm authentication fails before tag push or GitHub release creation.

This makes the invalid state “GitHub release exists but npm package is stale” impossible on the normal release path.

## 10. Benchmark Correctness

Benchmark commands are split into read-only and write modes.

Read-only commands:

```bash
npm run benchmark
npm run benchmark:multilingual
```

Write commands:

```bash
npm run benchmark:write
npm run benchmark:multilingual:write
```

Rules:

1. Read-only commands write to stdout only and leave the worktree clean.
2. Write commands update tracked benchmark reports.
3. Write commands fail if Python YAKE/reference dependencies are unavailable.
4. Incomplete benchmark reports are never written to tracked docs by default.

## 11. Performance Design

Correctness-by-construction should not imply object-heavy immutable code in hot paths.

Guidelines:

1. Use type brands, not runtime wrappers.
2. Parse and validate config once at the boundary.
3. Avoid `Result` allocations in per-token or per-candidate hot loops.
4. Prefer dense arrays and integer IDs for token, term, and candidate tables where profiling supports it.
5. Avoid repeated normalization by storing normalized tokens and terms once.
6. Avoid constructing rejected candidates.
7. Keep phase APIs explicit so each phase can be benchmarked independently.

Potential high-performance internal shape:

```ts
interface TokenTable {
  readonly surface: readonly string[];
  readonly normalized: readonly string[];
  readonly tag: readonly TokenTag[];
  readonly sentenceId: Uint32Array;
  readonly position: Uint32Array;
}
```

## 12. Metrics and Measurement

### 12.1 Correctness Metrics

| Metric | Baseline | Target | Command / Method |
|---|---:|---:|---|
| Mutation score | ~74% | >= 85% | `npm run test:mutation` |
| No-coverage mutants | current report | decreasing | Stryker report |
| Public option drift defects | current known issues | 0 new | changelog/regression audit |
| Invalid core option usage | not enforced | 0 `YakeOptions` in core-designated modules | `rg "YakeOptions" src/core` once split, or phase-specific grep before split |
| Sentinel candidates | present historically | 0 | `rg "ComposedWord\(null\)|kind: \"rejected\"" src` |
| Python parity regressions | current lock set | 0 regressions | `npm test`, Python parity jobs |

### 12.2 Performance Metrics

| Metric | Baseline | Target | Command / Method |
|---|---:|---:|---|
| End-to-end benchmark runtime | current `npm run benchmark` plus local fixture benchmark | no worse than +5%; ideally 10-30% faster | `npm run benchmark`; future `benchmark:core` must avoid network fetches |
| Heap delta | current benchmark | no worse than +10%; ideally lower | benchmark report / `--expose-gc` harness |
| Bundle gzip | ~44 KiB | < 64 KiB | `npm run bundle-size` |
| Package tarball size | ~116 KiB | no material growth | `npm pack --dry-run` |
| Phase timings | not fully split | measured per phase | new `benchmark:core` script |
| Similarity cache hit/miss | size only | hit/miss/eviction counters | cache stats extension |

### 12.3 Process Metrics

| Metric | Target | Command / Method |
|---|---:|---|
| Read-only benchmark dirties worktree | 0 files | `npm run benchmark && git status --short` |
| Tag validation failures after release | 0 | GitHub Actions |
| npm/GitHub release mismatch | 0 | `npm view`, `gh release view` |
| Manual release bypasses | 0 | release audit |

## 13. Required Baseline Capture

Before each major refactor phase, capture:

```bash
npm run verify
npm run benchmark
npm run benchmark:multilingual
npm run bundle-size
npm run test:mutation
npm audit --audit-level=low
```

Store the baseline in `docs/audits/` or `docs/benchmarks/` with the commit SHA, Node version, OS, and whether Python YAKE was available.

Record at least:

1. end-to-end benchmark duration
2. benchmark heap delta
3. bundle gzip size
4. package tarball size
5. mutation score by file
6. parity failures or skips
7. dirty-worktree behavior for benchmark commands
8. network/reference availability for benchmark commands

## 14. Pre-Implementation Follow-Ups From Spec Audit

The audit in `docs/audits/correctness-by-construction-spec-audit-2026-04-30.md` identified five mandatory follow-ups before or during implementation:

1. Add a local, network-free `benchmark:core` before major refactor work. `npm run benchmark` may continue to cover the remote Komoroske archive, but phase/refactor performance gates must have a checked-in fixture path that is stable offline.
2. Treat the `>= 85%` mutation score as the whole-program target, not a first-phase gate. Each phase should set its own local mutation target after baseline capture.
3. Before candidate refactoring, add ordering fixtures that pin candidate insertion/order semantics. Candidate correctness must not regress Python parity through accidental ordering changes.
4. Require readability and performance review before accepting dense-array or integer-ID data-layout rewrites. Dense layouts need a measured benefit, not just theoretical appeal.
5. Keep release validation even though the normal release script is npm-first. The script is the correct path, but GitHub tag validation and post-release audit remain necessary because maintainers can bypass scripts.

## 15. Incremental Migration Plan

### Phase 1: Config Boundary

1. Introduce `YakeConfig` and `parseYakeOptions`.
2. Move all defaults to `DEFAULT_YAKE_OPTIONS`.
3. Ensure core functions consume `YakeConfig`, not `YakeOptions`.
4. Add grep/test guard for raw public options in core.

Acceptance:

- no parity regression
- no performance regression beyond +2%
- no duplicate default literals for public options

### Phase 2: Candidate Model

1. Remove sentinel candidate construction.
2. Add valid/rejected candidate builder.
3. Score only valid candidates.
4. Add properties for candidate size, normalized form, and term presence.

Acceptance:

- mutation score improves
- candidate validity logic has no nullable sentinel states
- no parity regression

### Phase 3: Pipeline Decomposition

1. Extract text/token/term/graph/candidate/score/dedup phases.
2. Add phase-level tests and fixtures.
3. Add phase timing benchmark.

Acceptance:

- no phase function exceeds agreed complexity threshold without justification
- phase benchmark exists
- end-to-end runtime no worse than +5%

### Phase 4: Similarity and Dedup

1. Add branded `Similarity01` at helper boundaries.
2. Add canonical fixtures for Jaro, Levenshtein, and `seqm`.
3. Add cache hit/miss/eviction stats if useful.

Acceptance:

- mutation score for `similarity.ts` materially improves
- no dedup parity regression
- cache remains bounded

### Phase 5: Data Layout Optimization

1. Profile current object-heavy structures.
2. Introduce dense token/term/candidate tables only where benchmarks justify them.
3. Keep public API unchanged.

Acceptance:

- runtime improves or memory decreases enough to justify complexity
- bundle gzip remains under budget
- readability audit passes

## 16. Acceptance Criteria for the Whole Program

The correctness-by-construction refactor is successful when:

1. `npm run verify` passes.
2. `npm run test:mutation` reports >= 85% overall score or a documented, justified exception.
3. Python parity locks do not regress.
4. `npm run benchmark` leaves the worktree clean.
5. `npm run bundle-size` remains under 64 KiB gzipped.
6. End-to-end runtime is no worse than +5% from the phase baseline.
7. Heap use is no worse than +10% from the phase baseline.
8. No core module accepts raw `YakeOptions`.
9. No valid candidate type can represent an empty/sentinel candidate.
10. Release flow cannot create a GitHub release before npm publish on the normal path.

## 17. Risks

1. Object-heavy purity could regress performance.
2. Type brands can create false confidence if conversion functions are loose.
3. Dense data layouts can reduce readability.
4. Parity can regress if phase boundaries change ordering semantics.
5. Release correctness still depends on maintainers using the release script rather than bypassing it.

Mitigations:

1. Benchmark every phase.
2. Keep brands compile-time only.
3. Require parity fixtures before algorithm changes.
4. Add focused property tests for each phase.
5. Document and audit release steps after each release.
