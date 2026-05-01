# Non-Idiomatic Code Audit and Remediation - 2026-05-01

## Scope

This audit captured codebase patterns that were weird, non-idiomatic, or likely to create future maintenance friction. It follows the TypeScript best-practices and duplication audits and records the remediation status for each item.

## Findings and Status

| # | Finding | Status | Notes |
|---:|---|---|---|
| 1 | Test-only internals exported from production modules | Fixed | Added `@internal` JSDoc to comparator and similarity helper exports. Root package exports remain deliberate. |
| 2 | Feature names were stringly typed | Fixed | Added `FeatureName`, `VALID_FEATURE_NAMES`, `isFeatureName()`, and `featureEnabled()`. Public options now type `features` as `readonly FeatureName[] | null`; config parsing rejects unknown feature names. |
| 3 | `SingleWord.addOccur()` used optional chaining for a guaranteed map entry | Fixed | Replaced with a local `occurrences` binding that creates the array once and then pushes into a definite value. |
| 4 | Repeated non-null assertions hid invariants | Partially fixed | Removed the candidate-map assertion in `DataCore.addOrUpdateComposedWord()` and made the stricter compiler pass clean. Some localized array assertions remain where loop bounds prove the invariant. |
| 5 | `ComposedWord` kept an unreachable `terms.length === 0` stopword guard | Fixed | Constructor already rejects no-term candidates, so start/end stopword logic now assumes at least one term. |
| 6 | `sequenceSimilarity()` had unreachable defensive branches | Fixed | Removed unreachable empty/max-length and empty-char-union guards after the identity and prefilter gates. |
| 7 | `KeywordExtractor` repeated similarity-cache dispatch | Fixed | Added `runWithSimilarityCache()` and routed `levs`, `seqm`, and `jaro` through it. |
| 8 | Optional property semantics were inconsistent | Fixed | Enabled `exactOptionalPropertyTypes`; CLI and document result builders now omit absent optional fields rather than explicitly setting `undefined`. |
| 9 | Public config objects included undefined values | Fixed | CLI now builds extractor options incrementally and only includes defined values. |
| 10 | No lint layer | Fixed | Added ESLint with TypeScript support and wired `npm run lint` into `npm run verify`. |
| 11 | Test casts bypassed domain types | Fixed | Candidate ordering tests now use a narrow structural fixture; comparator helpers accept a `ComparableCandidate` shape instead of full `ComposedWord`. |
| 12 | Similarity tests were somewhat over-concentrated | Deferred | No behavior change in this slice. The split is documented as follow-up because reorganizing tests now would add churn without changing correctness. |
| 13 | Runtime parsing in tests used unchecked assertions | Fixed | Added `test/helpers/python-output.ts` runtime guards for Python keyword-result and numeric output parsing. |
| 14 | `DataCore` is a broad algorithm orchestrator | Deferred | This is an architectural refactor, not a safe quick fix. Phase timing and candidate construction seams already exist; future split can target `TermIndex`, `CandidateBuilder`, and feature pipeline components. |
| 15 | Mutable scoring objects are non-idiomatic modern TS | Accepted | `SingleWord` and `ComposedWord` remain mutable for algorithm parity and performance. Public result objects stay separate from mutable internals. |

## Compiler/Tooling Changes

`tsconfig.json` now enables stricter checks:

- `exactOptionalPropertyTypes`
- `noImplicitOverride`
- `noPropertyAccessFromIndexSignature`
- `noUncheckedIndexedAccess`
- `noUnusedLocals`
- `noUnusedParameters`

ESLint was added with TypeScript support and is part of `npm run verify`.

## Remaining Intentional Debt

1. Similarity tests should still be reorganized by concern:
   - algorithm examples,
   - cache ownership/boundedness,
   - internal prefilter/trigram helpers.
2. `DataCore` should be split only in a dedicated algorithm-core refactor with parity and benchmark checks.
3. Mutable scoring classes remain intentional until a pure pipeline can be proven equivalent and performant.

## Verification

The remediation slice should pass:

```bash
npm run typecheck
npm run lint
npm test
npm run test:cloudflare
npm run build
npm run check:package
npm run bundle-size
npm run benchmark:core
npm run test:mutation
```

Python-backed benchmark commands remain recommended before release-report updates.
