# TypeScript Best Practices for Yaket

This document captures the TypeScript practices Yaket should optimize for as a published ESM library that also runs in browsers, workers, and Node.js.

## Compiler Configuration

1. **Use `strict: true` as the baseline.**
   - Keep `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and related checks enabled through `strict`.

2. **Prefer Node-compatible ESM settings for published packages.**
   - For this package, `module: "NodeNext"` and `moduleResolution: "NodeNext"` are appropriate because `package.json` uses `"type": "module"` and ESM exports.
   - Source imports should include the emitted `.js` extension.

3. **Generate declarations and declaration maps.**
   - Published TypeScript libraries should emit `.d.ts` and `.d.ts.map` files so consumers get accurate editor navigation.

4. **Consider progressively enabling stricter optional/index checks.**
   - `exactOptionalPropertyTypes` catches accidental `undefined` assignment to optional properties.
   - `noUncheckedIndexedAccess` catches unchecked array/map/index access.
   - `noPropertyAccessFromIndexSignature` makes dynamic dictionary access explicit.
   - `noUnusedLocals` and `noUnusedParameters` prevent dead code from accumulating.

5. **Use `skipLibCheck` deliberately.**
   - `skipLibCheck: true` is common for package build performance, but it should not be treated as a substitute for checking Yaket's own types.

## Public API Design

1. **Keep root exports intentional and stable.**
   - The package root (`src/index.ts`) is the supported API surface.
   - Non-root exported helpers should be documented as internal if they exist only for tests or decomposition.

2. **Prefer `interface` for extensible public object shapes.**
   - Hook contracts such as `TextProcessor`, `StopwordProvider`, and scoring strategy shapes are good interface candidates.

3. **Use discriminated unions for result/error boundaries.**
   - `Result<T, E>` style config parsing keeps validation explicit and avoids throwing deep in the pipeline.

4. **Avoid `any` in production code.**
   - `unknown` plus narrowing is preferred at trust boundaries.
   - Test-only `any` should be localized and commented.

5. **Use branded types only at validated boundaries.**
   - Brands such as positive integers or similarity thresholds are useful if constructors/parsers are the only way to produce them.

6. **Make mutability intentional.**
   - Public data returned to callers should prefer readonly properties where practical.
   - Internal scoring state may be mutable for performance, but that mutability should stay encapsulated.

## Runtime Boundaries

1. **Validate untrusted options at the boundary.**
   - Constructors and public functions should normalize options before core algorithm code sees them.

2. **Avoid Node built-ins in shared/browser code.**
   - Browser and worker entry points should stay free of `fs`, `path`, `child_process`, and similar modules.

3. **Separate CLI/tooling code from library code.**
   - CLI parsing and filesystem access should stay in CLI/scripts, not in the public extraction pipeline.

4. **Prefer explicit cache ownership.**
   - Module-level caches are acceptable for backwards compatibility, but long-running users should be able to pass explicit cache instances.

## Type-Level Correctness

1. **Represent optional absence consistently.**
   - With `exactOptionalPropertyTypes`, omit optional properties instead of setting them to `undefined`, or explicitly type them as `T | undefined`.

2. **Avoid non-null assertions unless an invariant is locally obvious.**
   - If `!` is needed repeatedly around the same structure, consider a helper that encodes the invariant.

3. **Validate parsed JSON and external process output.**
   - Type assertions after `JSON.parse()` are compile-time only. Runtime validation is needed for untrusted input.

4. **Use `satisfies` for object literals that must preserve literal types.**
   - This is preferable to broad annotation when defaults or maps must be checked without losing narrow values.

5. **Prefer named internal types for structural test fixtures.**
   - If a test only needs comparator fields, define a small `ComparableCandidate` type rather than casting partial objects to a full class.

## Testing and Tooling

1. **Keep typecheck in the normal verification path.**
   - `npm run verify` should remain the baseline pre-commit/pre-push quality gate.

2. **Use mutation testing for behavior-sensitive code.**
   - Mutation thresholds should encode the desired quality bar. If the target is 85%, Stryker's break threshold should be 85%.

3. **Add type-level tests for public API compatibility.**
   - Use `@ts-expect-error` intentionally for removed or invalid API shapes.
   - Consider `tsd`/`expect-type` or a dedicated `test-d` suite if public types become more complex.

4. **Keep tests deterministic.**
   - Property/fuzz tests should use fixed seeds or bounded data so CI remains stable.

5. **Group tests by behavior, not by implementation accident.**
   - Internal branch tests are useful, but they should be clearly labeled and not obscure the public behavior being protected.

## Release/Package Hygiene

1. **Use `exports` to define the package surface.**
   - Keep browser/worker exports intentional and verify them with package smoke tests.

2. **Run package validation before release.**
   - `npm pack --dry-run` and `publint` catch common packaging errors.

3. **Track bundle size and forbidden dependencies.**
   - Worker-compatible packages should fail if shared code starts importing Node-only modules.

4. **Document compatibility decisions.**
   - If internal helpers are exported only for testability, or if certain strict compiler flags are deferred, capture the reason in audits.
