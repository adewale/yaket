# TODO

Deferred items tracked here intentionally remain outside the current implementation tranche.

## Parity drift (low priority, headline drift is fixed)

1. ~~Investigate the remaining mid-rank Portuguese drift around `plataforma`,
   `Arquivo.pt`, `Ricardo Campos investigador`~~. **Partially addressed
   in 2026-06-10:** `Arquivo.pt` is now surfaced by the tokenizer-parity
   fix (see `docs/audits/architecture-algorithms-data-structures-and-tests-2026-06-10.md`,
   finding 4). The remaining "Ricardo Campos investigador" position
   delta is rooted in segtok's sentence-merge behavior on `.pt .`
   patterns; tracked as item 7.
2. Investigate the upstream tie-break ordering used when several candidates
   share byte-identical scores (visible on the Arabic AI sample at positions
   3-5; the `test/multilingual-parity.test.ts` Arabic head is intentionally
   trimmed to top-2 to avoid this until it is resolved). Root cause is
   1-3 ULP feature-score deltas captured in
   `docs/algorithm-drift.md`; needs upstream-bit-exact float math.
3. Investigate the Spanish 9/10 multilingual benchmark head (one position
   inside the upstream top-10 differs); the regression test pins what we
   reproduce today so a fix shows up as a parity gain.

## Coverage / verification breadth

4. Run `npm run test:mutation` periodically. As of 2026-06-10 the Stryker
   `mutate` list spans `src/similarity.ts`, `src/SingleWord.ts`,
   `src/ComposedWord.ts`, `src/KeywordExtractor.ts`, `src/config.ts`,
   `src/graph.ts`, and `src/lemma.ts`; the configured break threshold is
   85%. Most remaining `src/similarity.ts` survivors are equivalent
   mutants (cache-hit short-circuits, length-symmetric Levenshtein swap,
   simple-vs-matrix threshold). Future work is scheduling and triage, not
   infrastructure.

## Pluggable surface follow-ups

5. ~~Optional `lemmaAggregation` policy (`min` / `mean` / `max` /
   `harmonic`) wired to the existing `Lemmatizer` hook so consumers can
   match upstream YAKE's score-merging behavior without bundling spaCy /
   NLTK.~~ **Shipped 2026-06-10** — see CHANGELOG `## Unreleased`.

## Adoption track

6. Keep Bobbin's integration validation current as Bobbin evolves. The 0.6
   release dropped the snake_case aliases; consumers still on 0.5.x should
   follow `docs/migration-bobbin-0.6.md` before upgrading.

## Deferred follow-ups discovered in the 2026-06-10 audit

7. **Segtok sentence-merge parity.** `splitSentences` does not implement
   segtok's behavior of folding `.pt . Nesta` into one sentence. This is
   the residual cause of the Portuguese "Ricardo Campos investigador"
   position delta. Substantial change with regression risk on the
   existing tokenizer-parity corpus.

8. ~~**`SimilarityCache` eviction is FIFO, doc says LRU.**~~ **Resolved
   2026-06-10:** implemented true LRU — every cache hit re-inserts the
   key (`readBoundedCache`), so eviction removes the least-recently-used
   entry. Four per-path regression tests in
   `test/similarity-cache-isolation.test.ts` pin the behavior.

9. ~~**`docs/architecture.md` is pre-0.6.1.**~~ **Resolved 2026-06-10:**
   Module Map, ASCII diagram, Extraction Flow, and Extension Points now
   describe `config.ts`, `defaults.ts`, `features.ts`, and `lemma.ts`.

10. ~~**Dedicated `data-core.test.ts`.**~~ **Resolved 2026-06-10:** new
    `test/data-core.test.ts` pins constructor defaults, term-index
    semantics (plural-trim, stopword marking, saveNonSeen), document
    statistics, window-skip co-occurrence behavior (validated against
    upstream Python YAKE), and composed-word frequency counting.
