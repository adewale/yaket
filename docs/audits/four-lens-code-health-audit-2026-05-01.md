# Four-Lens Code Health Audit - 2026-05-01

## Scope

This reruns the audit model captured in `docs/lessons-learned.md` after the non-idiomatic TypeScript remediation. The four lenses are:

1. TypeScript/compiler audit
2. Design/architecture audit
3. Testing audit
4. Runtime/package audit

## 1. TypeScript / Compiler Audit

Commands:

```bash
npm run typecheck
npm run lint
```

Result: passed.

Current status:

- `strict` remains enabled.
- Additional strictness is now enforced in `tsconfig.json`:
  - `exactOptionalPropertyTypes`
  - `noImplicitOverride`
  - `noPropertyAccessFromIndexSignature`
  - `noUncheckedIndexedAccess`
  - `noUnusedLocals`
  - `noUnusedParameters`
- ESLint is present and included in `npm run verify`.
- Feature options are typed with `FeatureName` and config parsing rejects unknown feature names.
- Python-output parsing helpers now validate JSON shape at runtime in parity tests.

Residual notes:

- Local non-null assertions remain where loop bounds or prior assertions establish an invariant. They are accepted under `noUncheckedIndexedAccess` and should be revisited opportunistically, not as a blocker.
- Test-only `any` remains only in canonical-options tests where intentionally probing removed JavaScript API shapes.

## 2. Design / Architecture Audit

Inspection command:

```bash
rg -n " as any| as ComposedWord|@ts-ignore|eslint-disable|TODO|FIXME|features\\?: string|features: string\\[\\]|process\\.env\\.[A-Z]|JSON\\.parse\\([^\\n]+\\) as|similarityCache == null|terms\\.length === 0|featureEnabled\\(|@internal|class DataCore|\\.get\\([^\\n]+\\)!|\\[[^\\n]+\\]!" src test docs
```

Result: no new blocking design issues.

Status by previously weird pattern:

- Internal comparator/similarity helpers are marked `@internal`.
- Feature checks use `featureEnabled()` and typed feature names.
- `KeywordExtractor` similarity-cache dispatch is centralized in `runWithSimilarityCache()`.
- The unreachable `ComposedWord` start/end stopword empty-terms guard was removed.
- Unreachable `sequenceSimilarity()` defensive branches were removed.
- `SingleWord.addOccur()` now preserves the map-entry invariant through a local binding.
- `DataCore.addOrUpdateComposedWord()` no longer uses a non-null map assertion for frequency updates.

Accepted/deferred design debt:

- `DataCore` remains a broad algorithm orchestrator. This is accepted until a dedicated decomposition can preserve Python parity, mutation score, bundle budget, and benchmark performance.
- `SingleWord` and `ComposedWord` remain mutable internal scoring objects for parity/performance reasons.
- Similarity tests remain somewhat spread across cache, isolation, and internals files; consolidation is a low-risk cleanup task, not a correctness blocker.

One fresh consistency fix from this pass:

- `docs/api-reference.md` was updated from `features?: string[] | null` to `features?: readonly FeatureName[] | null` so docs match the current public type.

## 3. Testing Audit

Commands:

```bash
npm test
npm run test:mutation
```

Results:

- Vitest: 38 passed, 2 skipped; 239 tests passed, 3 skipped.
- Mutation testing: passed the enforced 85% threshold.
  - Overall mutation score: 86.53%
  - Covered score: 87.42%
  - Killed mutants: 664
  - Timeout mutants: 17
  - Survived mutants: 98
  - No coverage mutants: 8

Current status:

- Mutation target remains enforced in Stryker config.
- Direct tests cover config boundaries, feature validation, scoring internals, candidate ordering, similarity internals, cache behavior, package smoke, worker smoke, CLI behavior, parity fixtures, and property invariants.
- Test-only runtime parsing has been centralized for Python output.

Residual notes:

- Mutation survivors remain concentrated in known hard-to-pin algorithm branches, especially similarity and candidate ordering. The whole-program target is met, so remaining survivors are improvement opportunities rather than blockers.
- Similarity-cache tests should still be reorganized by concern when convenient.

## 4. Runtime / Package Audit

Commands:

```bash
npm run verify
npm run bundle-size
npm run benchmark:core
PATH=/tmp/yaket-yake-venv/bin:$PATH npm run benchmark
PATH=/tmp/yaket-yake-venv/bin:$PATH npm run benchmark:multilingual
```

Results:

- `npm run verify`: passed.
  - includes typecheck, lint, Vitest, Cloudflare runtime smoke, build, package dry-run, and publint.
- Bundle size: passed.
  - minified gzip: 44.3 KiB, under the 64 KiB budget.
- Core benchmark: passed.
  - average extraction: 0.237 ms
  - p50: 0.208 ms
  - p95: 0.420 ms
- Python-backed Komoroske benchmark: passed.
  - Yaket/Python top-10 overlap: 9/10.
- Python-backed multilingual benchmark: passed.
  - most languages: 10/10 prefix and 10/10 top-k overlap.
  - Spanish: 9/10 prefix and 9/10 top-k overlap.
  - Arabic: 0/10 prefix and 10/10 top-k overlap.

Current status:

- Package output remains valid under `npm pack --dry-run` and `publint`.
- Worker/browser compatibility remains covered.
- Bundle size increased slightly with stricter typing/lint-related source additions but remains comfortably under budget.
- Performance remains in the same range as recent runs; no meaningful runtime regression was observed.

## Conclusion

The four-pass audit found no new blockers. The main improvement from rerunning the audit was catching and fixing stale API docs around `features`. The project now has stronger TypeScript enforcement, linting, maintained mutation coverage above the spec target, stable runtime/package checks, and documented residual architectural debt.

## Follow-Up Queue

1. Consolidate similarity tests by concern.
2. Add shared test builders for scoring fixtures.
3. Plan `DataCore` decomposition as a dedicated parity- and benchmark-gated refactor.
4. Consider scheduled mutation runs or a documented pre-release mutation gate in GitHub Actions/release docs.
