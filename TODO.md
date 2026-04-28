# TODO

Deferred items tracked here intentionally remain outside the current implementation tranche.

## Parity drift (low priority, headline drift is fixed)

1. Investigate the remaining mid-rank Portuguese drift around `plataforma`,
   `Arquivo.pt`, `Ricardo Campos investigador`, and the `seqm` dedup
   divergence on near-duplicate phrases. The leading 9 candidates of upstream
   `test_n3_PT` are now exact-match parity (locked in
   `test/multilingual-parity.test.ts`); positions 10+ still drift on a small
   number of names due to `seqm` dedup behavior on overlapping phrases.
2. Investigate the upstream tie-break ordering used when several candidates
   share byte-identical scores (visible on the Arabic AI sample at positions
   3-5; the `test/multilingual-parity.test.ts` Arabic head is intentionally
   trimmed to top-2 to avoid this until it is resolved).
3. Investigate the Spanish 9/10 multilingual benchmark head (one position
   inside the upstream top-10 differs); the regression test pins what we
   reproduce today so a fix shows up as a parity gain.

## Coverage / verification breadth

4. Run `npm run test:mutation` periodically against the scoring and dedup
   modules. Current baseline is 68.77 % overall, captured in
   `docs/audits/mutation-testing-2026-04-26.md`. Most remaining
   `src/similarity.ts` survivors are equivalent mutants (cache-hit
   short-circuits, length-symmetric Levenshtein swap, simple-vs-matrix
   threshold). Future work is scheduling and triage, not infrastructure.

## Pluggable surface follow-ups (only if a real adopter asks)

5. Optional `lemmaAggregation` policy (`min` / `mean` / `max` / `harmonic`)
   wired to the existing `Lemmatizer` hook so consumers can match upstream
   YAKE's score-merging behavior without bundling spaCy / NLTK.
   See `docs/lemmatization-evaluation.md` for the rationale.

## Adoption track

6. Keep Bobbin's integration validation current as Bobbin evolves. The 0.6
   release dropped the snake_case aliases; consumers still on 0.5.x should
   follow `docs/migration-bobbin-0.6.md` before upgrading.
