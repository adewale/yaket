# Lessons Learned

This document captures project lessons from the Git history and recent correctness work. It is intended to guide future implementation, testing, release, and documentation decisions.

## Source Review

Reviewed history from bootstrap through the latest TypeScript audit, including these notable phases:

- `5fe47c6` Bootstrap standalone YAKE-compatible TypeScript library
- `7b72e05` Bobbin adapter and edge-safe verification
- `2a4752f` Pluggable APIs, CLI, document/highlight helpers, benchmark tooling
- `e16d5cb` Cloudflare runtime coverage and architecture docs
- `bc7acb3` CI, Stryker, package smoke, cache and testing audits
- `99bb05c` `seqm` and tokenizer parity work
- `6143853` 0.6.0 multilingual parity, alias removal, pluggable internals
- `4fb53a1` / `d9b079e` correctness-by-construction slices
- `1554239` / `59e0572` / `80642e7` mutation coverage push
- `d50ae9f` mutation threshold enforcement
- `a8c7d1f` duplication/abstraction audit
- `2969e1a` TypeScript best-practices audit

## Product and Scope Lessons

### 1. Compatibility goals need explicit boundaries

Yaket started as a YAKE-compatible TypeScript library and repeatedly had to balance Python YAKE parity, Bobbin needs, browser/worker safety, package size, and public API shape.

Lesson: define compatibility targets by layer:

- Python YAKE parity for algorithm behavior,
- Bobbin compatibility for downstream integration,
- package API compatibility for npm users,
- worker/browser compatibility for deployment targets.

When these are conflated, small changes look like regressions even when they only affect one layer.

### 2. Drift is not always a bug, but it must be named

The history includes tokenizer and `seqm` parity work, multilingual reports, Arabic ordering drift, Spanish 9/10 parity, and algorithm-drift documentation.

Lesson: when exact parity is not achievable or not worth forcing, capture the drift explicitly with:

- fixture name,
- expected difference,
- likely root cause,
- whether it is accepted, deferred, or blocking.

This prevents repeated rediscovery of the same differences.

### 3. Small public API conveniences can become long-lived obligations

The 0.6.0 work removed legacy aliases and added migration docs. That cleanup was useful, but it required tests, docs, and release notes.

Lesson: prefer a small canonical API and reject legacy aliases at the config boundary. If compatibility aliases are added, treat them as a deliberate maintenance cost with an exit plan.

## Architecture Lessons

### 4. Runtime boundaries are as important as TypeScript types

`parseYakeOptions()` was introduced after API hardening. It rejects removed aliases, validates numbers, canonicalizes dedup function names, and feeds `KeywordExtractor` a normalized config.

Lesson: TypeScript protects TypeScript callers; runtime validators protect JavaScript callers, CLI paths, tests, and future refactors.

### 5. Correctness-by-construction works best when construction can fail explicitly

The removal of the empty/sentinel `ComposedWord` path and addition of `tryBuildCandidate()` / throwing `buildCandidate()` made invalid candidate construction visible.

Lesson: invalid domain objects should either not be constructible or should be represented as `null`/`Result`, not as partially valid sentinels.

### 6. Cache ownership must be explicit in long-running environments

The history moved from module-level similarity caches toward `createSimilarityCache()` and per-extractor cache injection, while preserving default behavior.

Lesson: module defaults are convenient, but worker/server users need bounded, explicit, request- or instance-owned caches.

### 7. Internal helpers are useful, but their API status must be clear

Mutation work exported comparator and similarity helper functions to test them directly. This improved test quality but created semi-visible module exports.

Lesson: if internals are exported for tests, mark them `@internal`, move them under `src/internal/`, or document that only root exports are stable.

## Testing Lessons

### 8. End-to-end fixtures are necessary but insufficient

Early tests emphasized reference extraction outputs and Python parity. Mutation testing later showed that many internal branches could change without failing tests.

Lesson: keep E2E/golden fixtures, but pair them with focused invariant tests for:

- config validation,
- candidate construction,
- scoring math,
- dedup boundaries,
- cache behavior,
- ordering/tie-break rules.

### 9. Mutation score should be an enforced threshold, not a dashboard number

The project reached the `>=85%` mutation target before Stryker was updated to fail below that target. `d50ae9f` fixed the mismatch.

Lesson: if a quality target matters, encode it in tooling. Otherwise the target becomes advisory and can silently regress.

### 10. Mutation testing reveals test design debt, not just missing assertions

Survivors clustered around `similarity.ts`, `SingleWord.ts`, and candidate ordering. Fixing them required direct helper tests and better state builders, not just more E2E fixture snapshots.

Lesson: when mutation survivors persist, look for missing abstractions and unclear seams. Better seams often kill more mutants than larger fixtures.

### 11. Property, fuzz, parity, and benchmark tests each answer different questions

History added property tests, differential Python tests, mutated fixture tests, golden fixtures, multilingual parity, worker smoke, package smoke, CLI coverage, and benchmarks.

Lesson: do not ask one test type to do every job:

- property tests: broad invariants,
- parity tests: upstream behavior,
- golden fixtures: regression stability,
- mutation tests: assertion quality,
- benchmarks: performance and resource budgets,
- package/worker smoke: deployment compatibility.

### 12. Tests can become duplicated when racing toward coverage

Recent audit found overlap between similarity cache diagnostics and isolation tests.

Lesson: after a mutation push, run a cleanup audit. Coverage-motivated tests should be reorganized by behavior once the target is met.

## Benchmark and Performance Lessons

### 13. Benchmark docs should be refreshed only when dependencies are available

Python-backed benchmark reports were refreshed only after a temporary Python YAKE venv was installed.

Lesson: avoid writing incomplete benchmark reports. If a dependency is missing, make the benchmark command pass read-only and clearly report the unavailable comparison.

### 14. Performance budgets need simple local fixtures

`scripts/benchmark-core.ts` added a no-network, no-Python benchmark with phase timings.

Lesson: keep at least one benchmark that is cheap, deterministic, checked in, and runnable by any contributor. Use heavier Python-backed benchmarks for parity/report refreshes.

### 15. Quality work must watch bundle size and worker compatibility

Config validation and testability exports did not materially change gzip size or core runtime performance. Bundle checks kept that visible.

Lesson: every hardening slice should rerun bundle and worker checks so correctness improvements do not accidentally harm edge deployments.

## Release and Operations Lessons

### 16. Release automation must match credential reality

0.6.0 GitHub release/tagging succeeded, but npm publishing was blocked by missing npm auth. The user explicitly does not want `NPM_TOKEN` in GitHub.

Lesson: do not build workflows around secrets that the project will not store. Use manual npm-first release flow and GitHub validation-only automation.

### 17. Package validation belongs in normal verification

`npm pack --dry-run`, `publint`, package smoke tests, and docs-sync tests caught packaging/API/documentation risks.

Lesson: for libraries, build success is not enough. Verify the package as consumers will install and import it.

### 18. CI compatibility can require dependency/toolchain alignment

History includes lockfile refreshes, esbuild/Vitest alignment, and GitHub Actions Node compatibility updates.

Lesson: CI/tooling changes are part of product reliability. Capture lockfile/toolchain fixes in release notes or audits when they affect reproducibility.

## Documentation Lessons

### 19. Docs and audits are valuable as executable memory

The project accumulated architecture docs, roadmap, migration docs, benchmark reports, mutation audits, correctness specs, TypeScript practices, and duplication audits.

Lesson: write down why decisions were made, not only what changed. Future agents and contributors can then continue without re-litigating context.

### 20. Documentation should be checked against code where possible

`test/docs-sync.test.ts` protects documented APIs and CLI flags.

Lesson: docs that mention public APIs should have at least a smoke-level synchronization test.

## TypeScript Lessons

### 21. `strict` is the start, not the finish

The TypeScript audit showed `strict: true` is enabled, but stricter flags such as `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` still reveal cleanup work.

Lesson: adopt stricter TypeScript in stages. Use exploratory compiler runs to discover issues before making flags mandatory.

### 22. Optional property semantics should be consistent

The stricter compiler pass found places where optional fields are explicitly assigned `undefined`.

Lesson: either omit absent optional properties or type them as `T | undefined` intentionally. Mixing both styles makes exact optional semantics harder to adopt.

### 23. Test casts are signals for missing narrower types

`candidate-ordering.test.ts` casts partial objects to `ComposedWord` to test comparators.

Lesson: if tests only need a structural subset, the production function may also only need that subset. Introduce narrower types instead of forcing full-class casts.

## Process Lessons for Future Work

1. Start with a spec or audit when changing correctness-critical behavior.
2. Add boundary validation before deeper algorithm changes.
3. Keep Python parity and benchmark tooling available before refreshing reports.
4. Use mutation testing to measure assertion quality, then enforce the threshold.
5. After coverage pushes, run duplication/internal-consistency cleanup.
6. Keep public API surface small and distinguish root exports from internals.
7. Verify package, worker/browser, bundle, benchmark, and mutation budgets before release.
8. Avoid publishing automation that depends on unavailable or undesired secrets.
9. Commit audits/docs alongside code so future history is interpretable.

## Current Follow-Up Queue Informed by These Lessons

- Finish the TypeScript best-practices remediation slice:
  - exact optional property cleanup,
  - index-safety cleanup,
  - lint layer,
  - internal export annotations,
  - narrower comparator types,
  - runtime JSON guards where useful,
  - feature-name abstraction.
- Consolidate similarity-cache tests by behavior.
- Add shared test builders for scoring fixtures.
- Document or simplify unreachable defensive branches in `sequenceSimilarity()`.
- Keep mutation target enforced and consider scheduled/manual mutation runs before releases.
