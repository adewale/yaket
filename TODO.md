# TODO

Deferred items tracked here intentionally remain outside the current implementation tranche.

## Parity drift (low priority, headline drift is fixed)

1. ~~Investigate the remaining mid-rank Portuguese drift around `plataforma`,
   `Arquivo.pt`, `Ricardo Campos investigador`~~. **Resolved 2026-06-10:**
   the segtok sentence-merge port (item 7) + the `isSlidingNgramTie`
   removal + the numpy-compatible pairwise sum for `stdTf` pulled the
   Portuguese top-20 to exact-name parity with upstream. `Arquivo.pt`,
   `Ricardo Campos investigador`, and the previously-misplaced
   `plataforma` candidate are now all in the upstream-matching positions
   (see `test/multilingual-parity.test.ts` and
   `docs/algorithm-drift.md`).
2. Investigate the upstream tie-break ordering used when several
   candidates share byte-identical scores (visible on the Arabic AI
   sample at positions 3-5; the `test/multilingual-parity.test.ts`
   Arabic head is intentionally trimmed to top-2). **Diagnosis sharpened
   2026-06-10:** the residual is `Math.log` precision drift between V8
   and glibc — V8's `Math.log(3)` differs from Python's by 1 ULP, which
   propagates through `wcase` / `wpos` and lands inside the comparator's
   tie-break tolerance for these three trigrams. Closing this requires
   porting glibc's `e_log.c` into the scoring path. Documented in
   `docs/algorithm-drift.md`; deferred until a real adopter needs
   byte-exact ordering past the tracked heads.
3. ~~Investigate the Spanish 9/10 multilingual benchmark head (one
   position inside the upstream top-10 differs); the regression test
   pins what we reproduce today so a fix shows up as a parity gain.~~
   **Resolved 2026-06-10:** the `isSlidingNgramTie` removal lifted the
   Spanish head from 9/10 to a full 12/12 match. The expected fixture
   in `test/multilingual-parity.test.ts` is now the full top-12.

## Coverage / verification breadth

4. ~~Run `npm run test:mutation` periodically. As of 2026-06-10 the
   Stryker `mutate` list spans `src/similarity.ts`, `src/SingleWord.ts`,
   `src/ComposedWord.ts`, `src/KeywordExtractor.ts`, `src/config.ts`,
   `src/graph.ts`, and `src/lemma.ts`; the configured break threshold is
   85%. Most remaining `src/similarity.ts` survivors are equivalent
   mutants (cache-hit short-circuits, length-symmetric Levenshtein swap,
   simple-vs-matrix threshold). Future work is scheduling and triage,
   not infrastructure.~~ **Resolved 2026-06-10:** the `mutation` job in
   `.github/workflows/ci.yml` now runs on `workflow_dispatch` and on a
   weekly schedule (`cron: '0 6 * * 0'`). The Stryker `break` threshold
   (85%) makes the scheduled job fail loudly if any tracked file falls
   below it, so survivors cannot pile up between manual runs. Triage
   remains a manual review activity tracked through the audit cadence.

## Pluggable surface follow-ups

5. ~~Optional `lemmaAggregation` policy (`min` / `mean` / `max` /
   `harmonic`) wired to the existing `Lemmatizer` hook so consumers can
   match upstream YAKE's score-merging behavior without bundling spaCy /
   NLTK.~~ **Shipped 2026-06-10** — see CHANGELOG `## Unreleased`.

## Adoption track

6. Keep Bobbin's integration validation current as Bobbin evolves. The
   0.6 release dropped the snake_case aliases; consumers still on 0.5.x
   should follow `docs/migration-bobbin-0.6.md` before upgrading.
   **Cadence documented 2026-06-10:** the three-layer re-validation
   protocol (per-push adapter shape, per-push 5-keyword golden,
   Bobbin-side topic-suite re-run on Bobbin or Yaket releases) is now
   captured in `docs/integrations/bobbin.md#re-validation-cadence`.
   Refreshing the golden lives in
   `test/bobbin-validation.test.ts`.

## Deferred follow-ups discovered in the 2026-06-10 audit

7. ~~**Segtok sentence-merge parity.** `splitSentences` does not
   implement segtok's behavior of folding `.pt . Nesta` into one
   sentence. This is the residual cause of the Portuguese "Ricardo
   Campos investigador" position delta. Substantial change with
   regression risk on the existing tokenizer-parity corpus.~~ **Resolved
   2026-06-10:** `splitSentences` now applies segtok's
   `_abbreviation_joiner` rule (terminals preceded by whitespace are
   stray punctuation and do not split). Six new regression tests in
   `test/tokenizer-parity.test.ts` cover `Hello . World`, `Hello ! World`,
   `Hello ? World`, normal boundaries, and the actual `Arquivo.pt .
   Nesta plataforma` reference span. The Portuguese parity head extended
   from 9/9 to 16/16 candidates as a result.

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
