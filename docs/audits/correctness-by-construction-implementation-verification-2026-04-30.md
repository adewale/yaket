# Correctness-by-Construction Implementation Verification - 2026-04-30

Commit under verification: pending commit after `4fb53a1`.

## Implemented Slices

1. Config boundary hardening
   - `parseYakeOptions()` owns removed option alias rejection, defaulting, and `dedupFunc` validation.
   - `KeywordExtractor` consumes parsed `YakeConfig`.
   - Added direct config-boundary tests.

2. Candidate correctness
   - Removed the `ComposedWord(null)` sentinel construction path.
   - `DataCore.tryBuildCandidate()` returns `null` for raw candidate text with no terms in the document index.
   - `DataCore.buildCandidate()` throws for invalid candidate text instead of returning an empty candidate object.
   - Added candidate construction and ordering tests.

3. Phase-level benchmark visibility
   - `npm run benchmark:core` now reports end-to-end extraction plus `DataCore build`, `Single-term features`, and `Multi-term features` phase timings.

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

- Unit/integration tests: 33 passed, 2 skipped.
- Tests: 208 passed, 3 skipped.
- Cloudflare runtime smoke: passed.
- Package validation / publint: passed.

### `npm run benchmark:core`

Passed.

- Iterations: 200
- Sample documents: 4
- Documents/sec: 4308.94
- Heap delta: 2511.78 KB
- Keywords produced, including warmup: 2040
- DataCore candidates observed: 13400

End-to-end extraction:

- Total duration: 46.42 ms
- Average duration: 0.232 ms
- p50 duration: 0.201 ms
- p95 duration: 0.394 ms

Phase timings:

| Phase | Total ms | Avg ms | p50 ms | p95 ms |
|---|---:|---:|---:|---:|
| DataCore build | 29.76 | 0.149 | 0.131 | 0.255 |
| Single-term features | 1.57 | 0.008 | 0.006 | 0.016 |
| Multi-term features | 0.84 | 0.004 | 0.004 | 0.009 |

### `npm run benchmark`

Passed.

- Yaket runtime: 65.43 ms
- Yaket heap delta: 13229.43 KB
- Python YAKE unavailable locally: `ModuleNotFoundError: No module named 'yake'`
- Read-only benchmark command did not update the Komoroske benchmark report.

### `npm run benchmark:multilingual`

Passed.

- Languages compared: 9
- Python YAKE unavailable locally: `ModuleNotFoundError: No module named 'yake'`
- Read-only benchmark command did not update the multilingual benchmark report.

### `npm run bundle-size`

Passed.

| Entry | Minified | Bytes | Gzipped |
|---|---|---:|---:|
| `src/index.ts` | yes | 152.7 KiB | 43.9 KiB |
| `src/index.ts` | no | 190.5 KiB | 48.7 KiB |

The minified gzip bundle remains below the 64 KiB budget.

### `npm run test:mutation`

Passed.

- Overall mutation score: 74.24 %
- Covered mutation score: 77.15 %
- Killed mutants: 593
- Timeout mutants: 18
- Survived mutants: 181
- No-coverage mutants: 31

Per-file mutation scores:

| File | Score |
|---|---:|
| `ComposedWord.ts` | 72.73 % |
| `KeywordExtractor.ts` | 77.39 % |
| `similarity.ts` | 71.28 % |
| `SingleWord.ts` | 80.53 % |

The whole-program 85 % target is not met yet; per the spec, it remains a program-level target rather than a first-slice acceptance gate.

## Notes

- Python-backed parity benchmark comparison could not be measured in this local environment because Python YAKE is not installed.
- The locked TypeScript/Vitest parity tests still pass under `npm run verify`.
- The candidate-order fixture protects the current insertion order before deeper candidate refactors.
