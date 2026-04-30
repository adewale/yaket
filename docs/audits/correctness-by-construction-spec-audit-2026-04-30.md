# Correctness-by-Construction Spec Audit - 2026-04-30

Audited document: `docs/correctness-by-construction-spec.md`

## Scope

This audit checks whether the spec is:

1. aligned with the user's constraint that npm credentials should not live in GitHub,
2. complete enough to guide an implementation,
3. measurable enough to prevent subjective success criteria,
4. performance-aware enough to avoid a slow but "pure" rewrite,
5. consistent with the current 0.6.1 preparation work.

## Summary

Status: **usable with known follow-ups**.

The spec captures the intended correctness-by-construction direction and includes release, benchmark, core pipeline, candidate-model, similarity, metrics, and performance constraints. It is intentionally incremental rather than prescribing a high-risk rewrite.

## Positive Findings

1. **Release model is consistent with local-only npm credentials.**
   - GitHub Actions validates tags only.
   - npm publish remains local/manual.
   - GitHub release creation happens after npm publish in the normal path.

2. **Boundary/core distinction is clear.**
   - Public `YakeOptions` is restricted to boundary modules.
   - Core modules are expected to consume parsed `YakeConfig`.

3. **Performance risks are explicitly addressed.**
   - The spec rejects runtime-heavy wrappers in hot loops.
   - Dense arrays/integer IDs are allowed where profiling justifies them.
   - Acceptance criteria include runtime, heap, and bundle budgets.

4. **Benchmarks are corrected by construction.**
   - Read-only benchmark commands should not dirty the worktree.
   - Write commands require complete reference output.

5. **Metrics are concrete.**
   - Mutation score, bundle gzip, heap delta, runtime, parity, and process metrics are named with commands or measurement methods.

## Findings and Follow-Ups

### F1. `src/core/` is aspirational, not present yet

Severity: Low

The spec originally used `src/core` metrics even though the current repository has a flatter structure. The spec now clarifies that `src/core/` checks apply once the split lands, and before that the same rule applies to phase-designated modules.

Follow-up:

- During Phase 1, explicitly list which current files count as core for grep/audit checks.

### F2. Performance baseline needs a local fixture benchmark

Severity: Medium

`npm run benchmark` currently fetches a remote Komoroske archive, which is useful but not ideal as the sole performance baseline.

Follow-up:

- Add `benchmark:core` or equivalent using checked-in fixture text.
- Track phase timings without network dependency.

### F3. Mutation target is ambitious

Severity: Low

The spec targets >= 85% mutation score from a current ~74%. This is appropriate as a program goal but may not be reached in one or two phases.

Follow-up:

- Treat >= 85% as the whole-program target.
- Add per-phase mutation targets after the first baseline capture.

### F4. Candidate representation needs careful parity control

Severity: Medium

Removing sentinel candidates is correct, but candidate generation is ordering-sensitive and affects Python parity.

Follow-up:

- Before Phase 2, add candidate-order fixtures.
- Preserve insertion/order semantics explicitly in the new candidate builder.

### F5. Dense data layout can reduce maintainability

Severity: Medium

The spec permits dense arrays and integer IDs for performance. That may improve speed but can obscure algorithm intent.

Follow-up:

- Require a before/after benchmark and readability review before accepting dense-layout rewrites.
- Keep public debug/inspection helpers if object structures become less transparent.

### F6. Release script still depends on maintainers using it

Severity: Low

Correctness is guaranteed only on the normal path. A maintainer can still manually push tags or create GitHub releases out of order.

Follow-up:

- Keep release validation in GitHub Actions.
- Add post-release audit steps to compare `npm view`, tag SHA, and GitHub release tag.

## Consistency Checks

| Check | Result |
|---|---|
| No GitHub `NPM_TOKEN` requirement in spec | Pass |
| GitHub Actions described as validation-only | Pass |
| Benchmark write behavior matches new scripts | Pass |
| Metrics include correctness and performance | Pass |
| Performance budgets are explicit | Pass |
| Bundle-size budget preserved | Pass |
| Python parity preservation required | Pass |
| Spec acknowledges current architecture is not yet split | Pass |

## Recommended Next Steps

1. Commit the spec and audit with the 0.6.1 release-hardening changes.
2. Add a local fixture `benchmark:core` before starting large architectural work.
3. Start Phase 1 with `YakeConfig` / `parseYakeOptions` and a current-file core designation.
4. Capture a numeric baseline file in `docs/audits/` before Phase 1 implementation.
5. Defer dense data-layout changes until phase benchmarks identify a bottleneck.

## Audit Verdict

The spec is fit to guide an incremental correctness-by-construction refactor, provided the next phase begins with baseline capture and a local, network-free performance benchmark.
