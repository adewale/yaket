# Cache Brittleness Analysis

Date: `2026-04-16`

This note evaluates the bounded global similarity caches in `src/similarity.ts`.

## What exists today

The current implementation keeps three bounded module-level caches:

1. Levenshtein distance
2. Levenshtein ratio
3. sequence similarity

They are capped at `20_000` entries each and exposed through:

- `getSimilarityCacheStats()`
- `clearSimilarityCaches()`

## Why they might be brittle

Bounded global caches have two risks:

1. cross-request shared state in long-lived runtimes such as Cloudflare Workers
2. eviction behavior changing performance characteristics under sustained churn

They should not change keyword results, but they can affect memory usage and the shape of cache hit/miss behavior.

## Verification added

The current test suite now verifies that:

1. cache stats are observable and resettable
2. the bounded cache does not grow past `20_000` entries under large unique workloads
3. warm-cache and cold-cache extraction produce identical keyword outputs on the same text

Relevant tests:

- `test/similarity-cache.test.ts`

## Conclusion

The caches are currently **functionally safe but operationally shared**:

- results remain deterministic under cache churn
- growth is bounded
- state is shared across extractors and requests

## Remaining tradeoff

The main residual brittleness is architectural, not correctness-related:

- cache ownership is global rather than per-extractor or per-request

This is acceptable for the current package, but if edge memory pressure or tenant isolation becomes a stronger concern, the next step should be making cache strategy injectable.
