# Duplication, Internal Consistency, and Missing Abstractions Audit - 2026-05-01

Commit audited: `d50ae9f` plus working-tree inspection after mutation threshold enforcement.

## Scope

Reviewed the new mutation-target work and adjacent files for:

- duplicated production or test logic,
- internal consistency problems introduced by the new tests/exports,
- missing abstractions that would make the correctness-by-construction work cleaner and safer.

Primary files inspected:

- `src/KeywordExtractor.ts`
- `src/similarity.ts`
- `src/SingleWord.ts`
- `src/ComposedWord.ts`
- `stryker.conf.json`
- new/changed tests around candidate ordering, composed words, single words, similarity caches, similarity internals, and extractor hooks.

## Executive Summary

The new work is internally consistent enough to keep: mutation coverage is now enforced at the spec target (`break: 85`), runtime benchmarks are stable, and the additional tests lock down meaningful correctness boundaries.

The main follow-up opportunities are cleanup rather than emergency fixes:

1. Consolidate duplicated similarity-cache tests.
2. Move test-only helper exports behind an explicit internal/testing boundary.
3. Extract repeated feature-selection and similarity-dispatch patterns.
4. Add small shared test builders for `SingleWord` / `ComposedWord` fixtures.
5. Simplify unreachable defensive branches in `sequenceSimilarity()` or explicitly document why they remain.

## Findings

### 1. Similarity cache tests now overlap

Severity: low.

There is intentional but visible overlap between:

- `test/similarity-cache.test.ts`
- `test/similarity-cache-isolation.test.ts`

Duplicated themes include:

- `createSimilarityCache()` validation,
- max-size boundedness,
- custom cache isolation,
- cache-hit behavior.

This was useful while raising mutation coverage quickly, but the split is now conceptually fuzzy: `similarity-cache.test.ts` contains both cache diagnostics and algorithm examples, while `similarity-cache-isolation.test.ts` also tests cache behavior.

Recommendation:

- Keep `similarity-cache-isolation.test.ts` focused on isolation/boundedness.
- Move pure algorithm examples to a future `test/similarity-algorithms.test.ts`.
- Keep mutation-specific cache-hit sentinels in one place.

### 2. Internal helper exports are useful but under-labeled

Severity: medium-low.

The new tests import internals directly:

- `compareCandidates`, `isSlidingNgramTie` from `src/KeywordExtractor.ts`
- `trigrams`, `aggressivePreFilter`, `countSpaces` from `src/similarity.ts`

These are not exported from `src/index.ts`, so they are not promoted through the public root API. However, they are still exported symbols from source modules and will appear in generated declaration files for those modules.

Recommendation:

- Prefer one of these patterns:
  1. Move them to `src/internal/*.ts` and import from tests there.
  2. Add JSDoc `@internal` to make the intent explicit.
  3. Keep as-is but document that non-root module exports are not stable API.

Best next step: add `@internal` comments now; consider `src/internal/` during the next refactor.

### 3. Similarity dispatch has repeated optional-cache branching

Severity: low.

`KeywordExtractor` repeats the same pattern in `levs()`, `seqm()`, and `jaro()`:

```ts
return this.similarityCache == null
  ? helper(cand1, cand2)
  : helper(cand1, cand2, this.similarityCache);
```

This is small, but it produced multiple mutation survivors and is a sign that dispatch could be represented declaratively.

Recommendation:

- Introduce a private helper such as `withSimilarityCache()` or a lookup table from dedup function name to helper.
- Be careful not to regress readability; the current duplication is simple and low-risk.

### 4. Feature selection is repeated in scoring classes

Severity: medium-low.

Feature filtering appears as repeated string checks:

- `features == null || features.includes("wrel")`
- `features == null || features.includes("wfreq")`
- `features == null || features.includes("wspread")`
- `features == null || features.includes("wcase")`
- `features == null || features.includes("wpos")`
- `features == null || features.includes("KPF")`

This is correct but stringly typed. It also explains some surviving string-literal mutants.

Recommendation:

- Add a small abstraction:

```ts
function featureEnabled(features: readonly string[] | null | undefined, name: string): boolean {
  return features == null || features.includes(name);
}
```

- Longer term, consider canonical feature-name typing at the config boundary.

### 5. Test fixture construction is duplicated

Severity: low.

`test/composed-word.test.ts` defines a local `term()` helper for `SingleWord` setup. Similar setup logic appears in `test/single-word.test.ts` and could grow in future tests.

Recommendation:

- Add `test/helpers/scoring.ts` with builders like:
  - `makeGraph()`
  - `makeTerm()`
  - `makeCandidate()`

This would reduce friction for further mutation-killing tests around `ComposedWord` and `SingleWord`.

### 6. Some defensive branches in `sequenceSimilarity()` are effectively unreachable

Severity: low, but useful cleanup target.

Examples:

- `maxLength === 0` after the earlier `cand1 === cand2` fast path.
- `charUnion.size === 0` after non-identical string preconditions.

Mutation output still reports no-coverage/surviving mutants around these branches. The branches are harmless, but they complicate the state space.

Recommendation:

- Either remove/simplify unreachable branches after confirming behavior, or add comments explaining they are defensive guards retained for robustness.
- Prefer simplification if Python parity and property tests stay green.

### 7. Mutation target is now enforced, but only when mutation job runs

Severity: medium-low.

`stryker.conf.json` now enforces:

```json
"break": 85
```

This is good. However, `.github/workflows/ci.yml` still runs mutation testing only on `workflow_dispatch`.

Recommendation:

- Keep this for normal CI speed if desired.
- Consider a scheduled weekly mutation job or a required manual pre-release check.
- Document that `npm run test:mutation` is required before release/tagging.

### 8. Candidate ordering helper tests rely on casted partial objects

Severity: low.

`test/candidate-ordering.test.ts` casts partial objects as `ComposedWord`. This is acceptable for pure comparator tests, but it bypasses construction invariants.

Recommendation:

- Either keep the light-weight comparator fixture, or rename the helper to `candidateLike()` and define a narrower internal type accepted by the comparator.
- Longer term, `compareCandidates()` could accept a structural `ComparableCandidate` interface.

## Internal Consistency Check

No blocking inconsistencies found.

- `stryker.conf.json` now matches the correctness spec target.
- Benchmark results remain consistent with the performance budget.
- Bundle-size result remains under the 64 KiB gzip target.
- Python-backed benchmark parity remains consistent with previous known drift: Spanish is `9/10`, Arabic top-k overlap is `10/10` with ordering drift.
- npm publishing remains intentionally skipped and is not coupled to GitHub secrets.

## Recommended Next Cleanup Order

1. Add `@internal` JSDoc or move test-only exported helpers into `src/internal/`.
2. Consolidate similarity-cache tests into clearer files by concern.
3. Add `featureEnabled()` and replace repeated feature checks.
4. Add test fixture builders for graph/term/candidate setup.
5. Simplify or document unreachable `sequenceSimilarity()` defensive branches.
6. Add a scheduled/manual mutation workflow note to release docs.

## Conclusion

The new work is better than the old test surface and is internally coherent. The main cost is a small increase in exposed internals and some duplicated test coverage. Neither is a release blocker, but both should be cleaned up before the next larger refactor so the codebase keeps the correctness gains without accumulating test-only design debt.
