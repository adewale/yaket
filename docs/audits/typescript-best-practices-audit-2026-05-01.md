# TypeScript Best Practices Audit - 2026-05-01

Commit audited: `a8c7d1f` plus working-tree inspection.

Reference practices captured in: `docs/typescript-best-practices.md`.

## Audit Method

Reviewed TypeScript/package configuration and representative source/test code. Ran the existing typecheck and an exploratory stricter compiler pass.

Commands:

```bash
npm run typecheck
npx tsc -p tsconfig.tooling.json --noEmit \
  --noUncheckedIndexedAccess \
  --exactOptionalPropertyTypes \
  --noImplicitOverride \
  --noPropertyAccessFromIndexSignature \
  --noUnusedLocals \
  --noUnusedParameters
```

Baseline `npm run typecheck` passes. The exploratory stricter pass intentionally fails and produced useful improvement candidates listed below.

## Executive Summary

Yaket is in good TypeScript shape for a published ESM library:

- `strict: true` is enabled.
- `NodeNext` module and resolution settings match the ESM package configuration.
- `.d.ts`, declaration maps, and source maps are emitted.
- Public strategy/config shapes are mostly explicit interfaces.
- Runtime option parsing now exists at the package boundary.
- Worker/browser constraints are separately tested.

The main TypeScript gaps are not basic safety failures; they are stricter-mode and public-surface refinements:

1. `exactOptionalPropertyTypes` is not yet clean.
2. `noUncheckedIndexedAccess` is not yet clean.
3. Several internal helpers are exported for tests without being labeled `@internal`.
4. Test fixtures sometimes cast partial objects to full production classes.
5. There is no lint layer for unused variables, unsafe assertions, or style consistency.
6. JSON/external process parsing in tests uses compile-time assertions rather than runtime validation.

## Current Strengths

### 1. Strong compiler baseline

`tsconfig.json` has:

```json
"strict": true,
"module": "NodeNext",
"moduleResolution": "NodeNext",
"declaration": true,
"declarationMap": true,
"sourceMap": true
```

This is a strong baseline for an ESM TypeScript package.

### 2. ESM imports are aligned with NodeNext

Source files use emitted `.js` specifiers such as:

```ts
import { ComposedWord } from "./ComposedWord.js";
```

That is the correct pattern for NodeNext ESM output.

### 3. Runtime option validation complements static types

`parseYakeOptions()` gives Yaket a real runtime boundary. This is important because library consumers can call the package from JavaScript or pass untyped objects.

### 4. Public hook APIs are explicitly modeled

The public strategy and hook interfaces in `src/strategies.ts` are structurally clear and extensible.

### 5. Package hygiene is good

The project already validates:

- package exports via `npm pack --dry-run`,
- `publint`,
- bundle size,
- browser/worker compatibility,
- CLI smoke behavior.

## Findings and Recommendations

### Finding 1: `exactOptionalPropertyTypes` reveals optional-property inconsistencies

Severity: medium.

The exploratory strict pass reported assignments where optional properties are explicitly set to `undefined` or where an optional property type does not include `undefined`.

Representative examples:

- `src/cli.ts`: constructs `YakeOptions` with keys like `language: string | undefined`.
- `src/document.ts`: returns result objects with `title: undefined` / `metadata: undefined` while the interface marks those properties optional.
- `src/KeywordExtractor.ts`: assigns possibly undefined values to optional class properties.
- `src/DataCore.ts`: passes `features: string[] | null | undefined` into contexts whose optional feature property is effectively `string[] | null` under exact optional semantics.

Recommendation:

- Do not enable `exactOptionalPropertyTypes` globally yet.
- First refactor object construction to omit absent option/result keys, or widen selected public properties to `T | undefined` when explicit `undefined` is intentional.
- After cleanup, add the flag to `tsconfig.tooling.json` first, then production `tsconfig.json` if low-noise.

### Finding 2: `noUncheckedIndexedAccess` would catch several real invariant assumptions

Severity: medium.

The code uses non-null assertions in places where invariants are probably true but not encoded in types, for example:

- array indexing in `ComposedWord.updateH()` around neighboring terms,
- map access in `SingleWord.addOccur()`,
- candidate map access in `DataCore`,
- tests indexing result arrays.

Recommendation:

- Do not flip `noUncheckedIndexedAccess` globally in one step.
- Add local helpers for repeated invariants, e.g. `getExistingMapValue()` or `assertPresent()`.
- Start with production code before tests.

### Finding 3: `noPropertyAccessFromIndexSignature` highlights dictionary access assumptions

Severity: low-medium.

The exploratory pass flagged examples such as:

- `STOPWORDS.en`,
- `process.env.YAKET_PYTHONPATH`,
- parsed `packageJson.bin.yaket`,
- `stopwordsByLanguage.noLang`.

Recommendation:

- Keep ergonomic dot access for well-known public objects if desired.
- For true dictionaries and environment variables, prefer bracket access or explicit typed records.
- This flag is useful for tooling/tests but may be noisy for public examples.

### Finding 4: There is no lint layer

Severity: medium-low.

The project relies on TypeScript, tests, package validation, and mutation testing. That is strong, but it does not catch everything a lint layer would catch:

- unused imports/variables before stricter compiler flags are enabled,
- accidental `any`,
- unsafe type assertions,
- inconsistent promise handling,
- accidental public/internal export drift.

Recommendation:

- Add ESLint with `@typescript-eslint` or Biome as a separate follow-up.
- Start with low-noise rules and CI warning/failure only after the baseline is clean.

### Finding 5: Internal helpers exported for tests should be labeled or moved

Severity: medium-low.

Recent mutation work exports helpers from source modules:

- `compareCandidates`, `isSlidingNgramTie`
- `trigrams`, `aggressivePreFilter`, `countSpaces`

They are not exported from the root `src/index.ts`, which limits public exposure. But they still appear as module exports and declaration outputs.

Recommendation:

- Add `/** @internal */` JSDoc to test-only helper exports.
- Consider moving them to `src/internal/` if more internal helpers accumulate.

### Finding 6: Test-only casts bypass useful type guarantees

Severity: low.

Example:

```ts
return { uniqueKw, size, h, order } as ComposedWord;
```

This is acceptable for comparator tests, but it suggests the comparator wants a narrower structural type.

Recommendation:

- Introduce a `ComparableCandidate` type and have `compareCandidates()` / `isSlidingNgramTie()` depend on that shape.
- This would remove the need to cast partial objects to `ComposedWord`.

### Finding 7: JSON and subprocess outputs are asserted, not validated

Severity: low.

Tests parse JSON from fixtures/subprocesses and then assert TypeScript types, e.g.:

```ts
JSON.parse(line) as { name: string; result: Array<[string, number]> }
```

This is common in tests, but it is not runtime validation.

Recommendation:

- Keep as-is for trusted fixtures if desired.
- Add small runtime guards if Python parity fixtures become release-critical or user-controlled.

### Finding 8: Feature names are stringly typed at scoring sites

Severity: medium-low.

Feature checks are repeated string literals in `SingleWord` and `ComposedWord`.

Recommendation:

- Introduce a `FeatureName` union and `featureEnabled()` helper.
- Consider validating feature names at the config boundary.

## Best-Practice Alignment Matrix

| Area | Status | Notes |
|---|---:|---|
| `strict` baseline | Good | Already enabled. |
| ESM / NodeNext config | Good | Matches package ESM setup. |
| Declaration output | Good | `.d.ts` and maps emitted. |
| Runtime option validation | Good | `parseYakeOptions()` is a strong boundary. |
| Browser/worker compatibility | Good | Dedicated checks exist. |
| Mutation threshold | Good | `break: 85` now matches spec. |
| `exactOptionalPropertyTypes` readiness | Needs work | Exploratory pass fails. |
| `noUncheckedIndexedAccess` readiness | Needs work | Several invariants rely on `!`. |
| Linting | Missing | No ESLint/Biome config present. |
| Internal export discipline | Needs cleanup | Add `@internal` or move helpers. |
| Type-level public API tests | Partial | `@ts-expect-error` tests exist; no `tsd`/`expect-type`. |

## Suggested Remediation Plan

1. **Low-risk docs/API cleanup**
   - Add `@internal` JSDoc to non-root test helper exports.
   - Document root export as the only stable package API.

2. **Optional-property cleanup**
   - Fix object construction so absent optional properties are omitted.
   - Re-run with `--exactOptionalPropertyTypes`.

3. **Index-safety cleanup**
   - Add `assertPresent()` / map access helpers.
   - Remove repeated non-null assertions from production code.

4. **Feature-name typing**
   - Add `FeatureName` / `featureEnabled()`.
   - Optionally validate unknown feature names at config parse time.

5. **Lint/tooling addition**
   - Add ESLint or Biome with a small rule set.
   - Gate it in `npm run verify` once clean.

6. **Dedicated public type tests**
   - Consider `tsd` or `expect-type` when public API churn slows.

## Conclusion

The project already follows the most important TypeScript practices for a strict ESM library. The best next improvements are stricter optional/index safety and clearer internal API boundaries. None of the findings block the current correctness-by-construction work, but they are good candidates for the next hardening slice.
