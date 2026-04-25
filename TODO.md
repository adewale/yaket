# TODO

Deferred items tracked here intentionally remain outside the current implementation tranche.

## Deferred

1. Investigate the remaining mid-rank Portuguese drift around `plataforma`, `Arquivo.pt`, `Ricardo Campos investigador`, and the `seqm` dedup divergence on near-duplicate phrases. The leading 9 candidates of upstream `test_n3_PT` are now exact-match parity (locked in `test/multilingual-parity.test.ts`); positions 10+ still drift on a small number of names due to `seqm` dedup behavior on overlapping phrases.
2. Investigate the upstream tie-break ordering used when several candidates share byte-identical scores (visible on the Arabic AI sample at positions 3-5).
