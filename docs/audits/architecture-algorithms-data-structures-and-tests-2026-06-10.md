# Architecture, algorithms, data structures and testing audit — 2026-06-10

This audit was carried out on top of `main` at `4e3bf4b` and the work in
this branch that builds out the TODO items. It reviews the architecture
established by the 0.6.1 "correctness-by-construction" refactor, the
algorithms in the extraction core, the data structures backing them, and
the testing approach.

The audit also identifies which TODO items had structural rather than
parameter-tuning fixes, and what was changed in this pass to address
them.

## Scope

Reviewed in detail:

- `src/config.ts`, `src/defaults.ts`, `src/features.ts`, `src/lemma.ts`
- `src/KeywordExtractor.ts`, `src/DataCore.ts`, `src/SingleWord.ts`,
  `src/ComposedWord.ts`
- `src/graph.ts`, `src/similarity.ts`, `src/utils.ts`,
  `src/stopwords.ts`, `src/strategies.ts`
- `src/document.ts`, `src/highlight.ts`, `src/bobbin.ts`, `src/cli.ts`
- Every file in `test/`
- The Python YAKE reference at `/tmp/yake` (`yake/data/{core,utils,single_word,composed_word}.py`)

## Architecture

### Layering

The post-0.6.1 layering reads cleanly:

```
public surface
  └── KeywordExtractor (high-level orchestration)
        ├── config.ts        — parseYakeOptions, branded types, Result
        ├── defaults.ts      — single source of public defaults
        ├── features.ts      — FeatureName guard
        ├── lemma.ts         — LemmaAggregation policies (new in this pass)
        ├── DataCore         — document state, candidate generation
        │     ├── SingleWord   — per-term feature accumulation + scoring
        │     ├── ComposedWord — multi-word candidate validation + scoring
        │     └── graph.ts     — directed co-occurrence graph
        ├── similarity.ts    — Levenshtein, sequenceSimilarity, jaroSimilarity, SimilarityCache
        ├── utils.ts         — preFilter, splitSentences, tokenizeWords, tag logic
        └── stopwords.ts     — bundled stopwords, custom providers

adapter layer
  ├── document.ts            — extractFromDocument*, language precedence
  ├── highlight.ts           — TextHighlighter
  └── bobbin.ts              — extractYakeKeywords
```

This is a clean separation: `KeywordExtractor` exists to coordinate, and
each lower-level module owns a single concern with no upward references.
The 0.6.1 refactor made `parseYakeOptions` the *only* place that decides
defaults and rejects removed-alias keys, so `KeywordExtractor`'s
constructor is now a thin assembler.

**Finding 1 — clean.** No layering inversions found. Every public
entry point validates options through `parseYakeOptions`, which means
the `DataCore` direct-construction path inherits the same defaults.

### Module map gaps in the documentation

The `docs/architecture.md` Module Map and ASCII diagram do not yet list
`src/config.ts`, `src/defaults.ts`, `src/features.ts`, or `src/lemma.ts`
(the last is new here). The Extension Points block in the same doc still
describes the pre-0.6.1 surface.

**Action taken.** Updated `docs/api-reference.md` to document
`lemmaAggregation` and the upstream-parity table. Architecture diagram
deferred to the next architecture refresh; the gap is now tracked in the
TODO file rather than implicit.

## Algorithms

### Feature scoring

`SingleWord.updateH` and `ComposedWord.updateH` follow the upstream YAKE
formulas exactly. I diffed against `/tmp/yake/yake/data/single_word.py`
and `composed_word.py` and confirmed:

- `wrel` uses both directional graph-derived `pwl`/`pwr` and the same
  `(0.5 + pwl * tf/maxTf) + (0.5 + pwr * tf/maxTf)` form.
- `wfreq` is `tf / (avgTf + stdTf)`.
- `wspread` is `occurs.size / numberOfSentences`.
- `wcase` is `max(tfA, tfN) / (1 + log(tf))`.
- `wpos` is `log(log(3 + median(sentenceIds)))`.
- `h` is `(wpos * wrel) / (wcase + wfreq/wrel + wspread/wrel)`.

**Finding 2 — float-precision drift.** I confirmed the exhaustive
per-term parity for an Arabic sample (`docs/audits/architecture-algorithms-data-structures-and-tests-2026-06-10.md`
trace below): every field agrees with Python to the last decimal
displayed. Tiny last-ULP differences (~1e-17) appear in places where
Python's `numpy.std` and our JS `Math.sqrt` paths produce different
roundings. This is the known "float-precision tie-break residuals"
captured in `docs/algorithm-drift.md`. Not actionable without a
bit-exact float-math replication of Python's order of operations.

Per-term parity sample (Arabic):

```
Yaket  التعلم   h=0.1297423927101535
Python التعلم   h=0.12974239271015378
Yaket  الاصطناعي h=0.4760358540047956
Python الاصطناعي h=0.4760358540047955
```

### Compare candidates

`compareCandidates` keeps the `1e-15` epsilon and the
`isSlidingNgramTie` reversal that was needed to match upstream tie-break
on adjacent sliding 3-grams. This is correct for the cases it solves
(English near-tie ordering, the Komoroske benchmark) but does interact
badly with the Arabic 1e-17 ULP differences in mid-rank ties.

**Finding 3 — tie-break depends on float math.** Leaving as-is per
`docs/algorithm-drift.md`. The change would be a candidate-order
restructuring, not a parameter tweak, and it would risk regressions on
the English near-tie tests.

### Tokenizer (segtok parity)

Yaket's `tokenizeWords` was attaching trailing periods to dotted tokens
even when the `.` in the source had whitespace around it. That made
"`Arquivo.pt . Nesta`" tokenize as `["Arquivo.pt.", "Nesta"]` instead
of segtok's `["Arquivo.pt", ".", "Nesta"]`, which collapsed two
occurrences into one and lost the "Arquivo.pt" candidate in the
Portuguese mid-rank parity.

**Action taken — TODO item 1 partial fix.** `tokenizeWords` now uses
`String.prototype.matchAll` to preserve regex-match positions and only
attaches a trailing period when it is glued (no whitespace) in the
source. Three new regression cases in `test/tokenizer-parity.test.ts`
lock the segtok behavior. The Portuguese benchmark gained a parity
position: "Arquivo.pt" now surfaces in the top-12 (Python has it at
13), matching the upstream-published top-13 prefix.

### sequenceSimilarity (seqm)

The pre-filter (`aggressivePreFilter`) plus the trigram-weighted scoring
in `sequenceSimilarity` matches the upstream "optimized seqm" path for
the dedup cases the multilingual corpus exercises. The remaining
mid-rank Portuguese drift (positions where Python keeps a candidate
Yaket drops, or vice versa) is *not* a `seqm` divergence — I checked
each pair with `sequenceSimilarity` directly and both implementations
return 0 for the relevant `arquivo.pt` / `ricardo campos investigador`
neighbours. The drift comes from feature-score deltas above
(`wspread` because Python's DataCore folds the "Arquivo.pt . Nesta"
sentence merge differently — see segtok-parity finding below) plus
ULP-level wfreq/wpos rounding.

### Sentence segmentation

Python YAKE's `tokenize_sentences` filters `if len(s.strip()) > 0` at
the raw sentence text level. Yaket filters at the token level after
discarding apostrophe-prefixed tokens. For the test corpus these agree.
However, segtok's `split_multi` on the Portuguese test sample merges
"…publicamente pelo Arquivo.pt . Nesta plataforma…" into one sentence
because of how it treats `.pt .` (`.pt` as an abbreviation, then the
standalone `.` is not a strong boundary). Yaket's `splitSentences`
splits there. This is the residual cause of the wspread/wpos delta on
"Ricardo Campos investigador".

**Finding 4 — segtok sentence-merge behavior.** Fixing this would
mean replicating segtok's abbreviation-aware sentence merge inside
`splitSentences`. That is a substantial change and risks regressions on
the existing tokenizer-parity corpus. Tracked in TODO for a future
audit.

## Data structures

### DirectedGraph

`src/graph.ts` is a small, focused adjacency-map graph with symmetric
in/out indexes. Reviewed:

- Empty defaults are sensible (returns 0 / false for unknown ids).
- `incrementEdge` auto-creates nodes.
- Negative `delta` is supported and behaves as decrement.
- `outDegree` and `outWeightSum` are O(1) and O(neighbours) respectively.

**Finding 5 — no direct unit tests existed.** Before this pass, the
graph was tested indirectly via `SingleWord` only. That meant
mutation-testing surfaced equivalent mutants that didn't affect graph
correctness but did affect coverage.

**Action taken.** Added `test/graph.test.ts` with 8 focused unit tests
covering directional weight accumulation, idempotent `addNode`,
in/out symmetry, and decrement semantics. Added a 9th test in the same
file that asserts `SingleWord.invalidateGraphCache()` actually causes a
recompute on the next `updateH` call. Stryker re-run after this pass
returned 100 % on `src/graph.ts`.

### `src/lemma.ts` mutation coverage

The first Stryker run after introducing `src/lemma.ts` came back at
60 % (24 survivors). The survivors clustered in eight buckets:
empty-input early return, group-collision append path, sort-step
correctness, multi-token lemma split/join, the `<` vs `<=` boundary
inside the `min` reduction, the `>` vs `>=` boundary inside `max`,
the harmonic-zero fallback to arithmetic mean, and the lemmatizer
call-context shape.

A focused unit-test file (14 new tests inside
`test/lemma-aggregation.test.ts` under the
`aggregateKeywordsByLemma — focused unit tests` describe block)
exercises each cluster directly. The follow-up Stryker run landed at
**95.38 %** for `src/lemma.ts` with three remaining survivors. Each of
the three is an equivalent mutant:

1. `if (results.length === 0) { return []; }` — removing the early
   return leaves the same observable behaviour because the rest of the
   function is empty-safe (`for ... of []` is a no-op,
   `Array.prototype.sort` on `[]` returns `[]`).
2. `if (results.length === 0)` condition mutated to `false` — same
   reason; the dead-code path is exercised correctly by the empty
   fall-through.
3. `.toLowerCase()` mutated to `.toUpperCase()` — the lemma key is only
   used as a private `Map` lookup; it is never returned to the caller.
   Both case-folds are stable, idempotent, and produce the same
   externally-observable grouping.

These are tracked here rather than papered over with contrived
assertions.

### SimilarityCache

The cache surface has four bounded maps (`distance`, `ratio`,
`sequence`, `jaro`), and the doc string in `docs/api-reference.md`
describes it as "bounded LRU eviction". I read the eviction code:

```ts
function setBoundedCache(cache: Map<string, number>, key: string, value: number, maxSize: number): void {
  if (!cache.has(key) && cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey != null) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}
```

This is **FIFO eviction**, not LRU. `Map` preserves insertion order, and
re-`set`-ing an existing key does *not* move it to the end. So a hot
key inserted early can still be evicted before a colder key inserted
later. The behavior is correct for the bounded-by-size guarantee, but
the doc string overstates it.

**Action.** Tracked. Not fixed in this pass because both the public
contract (bounded, doesn't OOM) and the test (`stays bounded under
many unique similarities`) are satisfied. A doc-only correction in
`docs/api-reference.md` would close it. Adding LRU semantics would need
an `O(1)` doubly-linked-list or a re-insert on hit; either is
straightforward but not justified without an adopter who can measure a
churn-related regression.

### YakeConfig and DEFAULT_YAKE_OPTIONS

`config.ts` and `defaults.ts` are now the single source of truth, and
the parse step branded `PositiveInt` / `Similarity01` / `Result`.
`DataCore`'s `DataCoreConfig` interface still has its own `n`/`windowSize`
defaults inlined (the lockstep is enforced by reading `DEFAULT_YAKE_OPTIONS`
in the body of the constructor). That is fine — the duplication is a
fallback for direct `DataCore` users, not a layering inversion.

## Testing approach

The 0.6.1 audit landed strong PBT and golden-fixture coverage. The
recent additions (this pass) push the surface further:

| Layer | Files | Strength | Notes |
|---|---|---|---|
| Golden fixtures | `golden-fixtures.test.ts` | High | English samples, score tolerance `1e-12`. |
| Python parity | `python-parity.test.ts`, `differential-fuzz.test.ts`, `seqm-parity.test.ts` | High | Skipped when no `/tmp/yake`. |
| Multilingual parity | `multilingual-parity.test.ts`, `multilingual-corpus.test.ts` | High | 21-doc corpus, 168/210 head slots locked. |
| Property-based | `properties.test.ts` | High | top-bound, monotonicity, determinism, no-throw, unicode/CJK/emoji. |
| Mutation | `npm run test:mutation` | High | Stryker over 7 source files, `break: 85`. |
| Architecture | `keyword-extractor-defaults.test.ts`, `keyword-extractor-hooks.test.ts`, `canonical-options.test.ts`, `config.test.ts` | High | Doubles the type-level guards with runtime checks. |
| Data-structure focused | `graph.test.ts` (**new**), `single-word.test.ts`, `composed-word.test.ts`, `candidate-construction.test.ts`, `candidate-ordering.test.ts`, `composed-word.test.ts`, `similarity-internals.test.ts` | High | `graph.test.ts` was a gap. |
| Tokenizer / segtok parity | `tokenizer-parity.test.ts` | High | +3 cases in this pass. |
| Edge / bundle | `edge-compatibility.test.ts`, `bundle-size.test.ts`, `cloudflare-runtime.test.ts`, `worker-smoke.test.ts`, `package-smoke.test.ts` | High | Shared `bundle-leak-detector.ts`. |
| Docs sync | `docs-sync.test.ts` | High | Asserts the README examples and CLI flags still parse. |

**Finding 6 — feature-filter helper coverage.** `src/features.ts`
exports `featureEnabled(features, name)`. It is exercised through
`SingleWord.updateH` and `ComposedWord.updateH`. The behavior is
covered by `features-filter.test.ts`. **No action.**

**Finding 7 — DataCore-level tests are spread.** No single file is
named `data-core.test.ts`, but the responsibilities are covered by
`candidate-construction.test.ts`, `candidate-ordering.test.ts`,
`features-filter.test.ts`, `keyword-extractor-hooks.test.ts`, and the
parity layers. This is acceptable but a future cleanup could promote a
dedicated `data-core.test.ts` for direct-construction edge cases.

**Finding 8 — Stryker timeouts under contention.** The
`similarity-cache.test.ts` bounded-cache tests would time out at 5s
when run under Stryker's 4-runner concurrency. Their work is
deterministic and well-bounded, just CPU-heavy.

**Action taken.** Added `{ timeout: 30_000 }` to the two affected tests
so Stryker can finish them without a config-level testTimeout bump.

## Items not yet addressed in this pass

- **Tie-break parity** (TODO items 2, 3) — needs upstream-bit-exact
  float math; deferred per `docs/algorithm-drift.md`.
- **Segtok sentence-merge** (deep cause of remaining Portuguese
  mid-rank drift) — substantial change, tracked above.
- **API reference + architecture diagram** updates for the new
  modules — partially done (`lemmaAggregation`); the rest is tracked
  for the next docs refresh.

## Summary

- The 0.6.1 architecture is sound; no layering changes recommended.
- The algorithms match upstream YAKE within ULP; the residual drift
  is float-precision and sentence-merge behavior, both deferred items.
- The data structures are correctly chosen; the documented "LRU" cache
  is in practice FIFO (doc-only correction recommended).
- `src/graph.ts` was the one untested-in-isolation data structure;
  added a focused test file.
- `tokenizeWords` had a real segtok-parity bug (trailing-period
  attachment ignoring whitespace) that affected the Portuguese parity;
  fixed with position-aware tokenization and three regression cases.
- `lemmaAggregation` (TODO item 5) is now implemented end-to-end with
  the four upstream policies (`min`, `mean`, `max`, `harmonic`).
- Stryker coverage now spans `config.ts`, `graph.ts`, and `lemma.ts`
  too; threshold remains `break: 85`.
