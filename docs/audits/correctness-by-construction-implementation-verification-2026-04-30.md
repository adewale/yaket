# Correctness-by-Construction Implementation Verification - 2026-04-30

Commit under verification: pending commit after `59e0572`.

## Implemented Slices

1. Config boundary hardening
   - `parseYakeOptions()` owns removed option alias rejection, defaulting, and `dedupFunc` validation.
   - `KeywordExtractor` consumes parsed `YakeConfig`.
   - Added direct config-boundary tests.

2. Candidate correctness
   - Removed the `ComposedWord(null)` sentinel construction path.
   - `DataCore.tryBuildCandidate()` returns `null` for raw candidate text with no terms in the document index.
   - `DataCore.buildCandidate()` throws for invalid raw candidate text instead of returning an empty candidate object.
   - Added candidate construction and ordering tests.

3. Phase-level benchmark visibility
   - `npm run benchmark:core` reports end-to-end extraction plus `DataCore build`, `Single-term features`, and `Multi-term features` phase timings.

4. Mutation coverage hardening
   - Added focused tests for `SingleWord`, `ComposedWord`, candidate ordering, similarity caches, similarity helper branches, and extractor hook boundaries.
   - Whole-program mutation score now exceeds the 85% spec target.

## Verification Commands

```bash
npm run verify
npm run benchmark:core
npm run benchmark
npm run benchmark:multilingual
npm run bundle-size
npm run test:mutation
```

## Results

### `npm run verify`

Passed.

- Unit/integration tests: 38 passed, 2 skipped.
- Tests: 238 passed, 3 skipped.
- Cloudflare runtime smoke: passed.
- Build, package dry-run, and publint: passed.

### `npm run benchmark:core`

Passed.

- Iterations: 200
- Sample documents: 4
- Documents/sec: 4389.32
- Heap delta: 2835.34 KB
- Keywords produced, including warmup: 2040
- DataCore candidates observed: 13400

End-to-end extraction:

- Total duration: 45.57 ms
- Average duration: 0.228 ms
- p50 duration: 0.196 ms
- p95 duration: 0.376 ms

Phase timings:

| Phase | Total ms | Avg ms | p50 ms | p95 ms |
|---|---:|---:|---:|---:|
| DataCore build | 29.22 | 0.146 | 0.126 | 0.263 |
| Single-term features | 1.80 | 0.009 | 0.006 | 0.016 |
| Multi-term features | 0.83 | 0.004 | 0.004 | 0.007 |

### `npm run benchmark`

Passed with Python YAKE available via `/tmp/yaket-yake-venv`.

- Yaket runtime: 62.44 ms
- Bobbin runtime: 101.68 ms
- TF-IDF runtime: 954.86 ms
- Python YAKE runtime: 229.00 ms
- Yaket/Python top-10 overlap: 9/10.

### `npm run benchmark:multilingual`

Passed with Python YAKE available via `/tmp/yaket-yake-venv`.

- Languages compared: 9
- Most languages: 10/10 leading prefix and 10/10 top-k overlap.
- Spanish: 9/10 leading prefix and 9/10 top-k overlap.
- Arabic: 0/10 leading prefix and 10/10 top-k overlap.

### `npm run bundle-size`

Passed.

| Entry | Minified | Bytes | Gzipped |
|---|---|---:|---:|
| `src/index.ts` | yes | 153.1 KiB | 44.1 KiB |
| `src/index.ts` | no | 191.1 KiB | 49.0 KiB |

The minified gzip bundle remains below the 64 KiB budget.

### `npm run test:mutation`

Passed.

- Overall mutation score: 86.27 %
- Covered mutation score: 87.33 %
- Killed mutants: 693
- Timeout mutants: 17
- Survived mutants: 103
- No-coverage mutants: 10

Per-file mutation scores:

| File | Score |
|---|---:|
| `ComposedWord.ts` | 84.30 % |
| `KeywordExtractor.ts` | 88.44 % |
| `similarity.ts` | 83.59 % |
| `SingleWord.ts` | 93.81 % |

The whole-program 85 % mutation target is now met.

## Notes

- npm publishing remains intentionally skipped; no GitHub `NPM_TOKEN` is required or stored.
- Python-backed parity benchmarks were measured using the temporary local venv at `/tmp/yaket-yake-venv`.
- Bundle size and worker/package validation remain within the established constraints.
