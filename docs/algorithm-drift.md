# Algorithm Drift From Upstream YAKE

Yaket aims to stay close to the upstream Python YAKE implementation, but it is not a byte-for-byte port.

This document makes the known drift points explicit.

## Main Drift Areas

### 1. `seqm` dedup behavior

The upstream YAKE default dedup function is `seqm`.

Yaket now regression-tests representative `seqm` examples and randomized candidate pairs against the current upstream optimized similarity path.

`seqm` is no longer the main actively tracked drift item, but it remains worth watching because it is heuristic rather than a simple canonical metric.

Known consequence:

1. mutation testing still shows this area is more brittle than the core scoring path, so regressions here are worth guarding carefully

### 2. `segtok` replacement

Upstream YAKE relies on Python tokenization and sentence splitting behavior that is influenced by `segtok`.

Yaket replaces this with a Unicode-aware JS implementation.

Known consequences:

1. contractions, abbreviations, and punctuation may split differently
2. multilingual and Unicode-heavy texts may drift more than English prose
3. exact token boundaries can differ even when high-level results remain close

Recent parity work closed concrete gaps around lowercase sentence starts, abbreviation token handling, ellipsis splitting, guillemet boundaries, Arabic question-mark attachment, and parenthetical sentence endings, but broader multilingual/tokenizer parity with `segtok` is still not finished.

### 3. Floating-point differences

Yaket and Python YAKE can differ in tiny score rounding details across runtimes.

This is why some tests use a very small score tolerance instead of strict equality.

## What Is Not A Drift Point

Yaket intentionally preserves the observed surface form in `keyword` while exposing `normalizedKeyword` for deduplication and downstream matching.

This is a documented API choice, not an accidental parity gap, even though some upstream YAKE paths return lowercased keywords.

The current Yaket implementation does **not** use the old Bobbin-style substring-only dedup approach.

It exposes:

- `seqm`
- `levs`
- `jaro`

The remaining dedup work is mostly regression-hardening, not a known standing behavior gap like the older substring-only approach.

## How To Read Benchmark Results

When Yaket differs from upstream Python YAKE, interpret the difference in this order:

1. tokenization or sentence-boundary drift
2. multilingual ranking drift
3. tiny floating-point drift
4. intentional API differences such as surface-form preservation

## Current Position

On the checked-in Komoroske benchmark:

- Yaket and Python YAKE overlap strongly
- Yaket is materially closer to upstream YAKE than the old Bobbin baseline

On the currently tracked upstream unit-test examples:

- the previously identified English near-tie ordering cases are fixed
- randomized `seqm` differential checks now match the upstream optimized path on the tracked parity corpus
- the upstream `test_n3_PT` Portuguese sample now exact-matches the upstream YAKE leading 9 candidates (locked in `test/multilingual-parity.test.ts`). The remaining mid-rank drift is dedup-driven (Yaket's `seqm` drops a few near-duplicate phrases that upstream keeps) rather than tokenizer-driven.
- single-paragraph multilingual parity heads for `de`, `es`, `it`, `fr`, `nl`, `ru`, `ar` are exact-match against upstream YAKE on the tracked samples.

The headline tokenizer fix that closed the major Portuguese drift was: trailing periods are no longer attached to a token when the only thing that follows is a sentence closer (e.g. `Histórias."` at the end of a sentence). This now matches segtok behavior and removed duplicate `Histórias.` / `Conta-me Histórias.` candidates that previously crowded out upstream-ranked entries.

### Float-precision tie-break residuals

The remaining tracked drift on `ar` (positions 3-5) and `es` (positions 10-11)
is **not** an algorithm bug but a 1-3 ULP float64 precision difference
between Yaket's and Python YAKE's scoring math. Upstream Python computes
slightly different floats for some candidates that score equal in Yaket
(or vice versa), and stable sort then orders them by insertion order.

Concretely, on the multilingual benchmark sample:

- Arabic positions 3-5 share byte-identical `h` in Yaket but differ by
  1-3 ULP in Python (e.g. `0.003473156652249835` vs
  `0.0034731566522498347`).
- Spanish positions 10-12 share byte-identical `h` in **both** Yaket and
  Python, so the order is purely insertion-order driven; Yaket's
  current `isSlidingNgramTie` reversal in `compareCandidates` is the
  source of the disagreement on the sliding-trigram pair.

A full fix would require replicating Python's float-arithmetic operation
order bit-exactly inside `SingleWord.updateH` and `ComposedWord.updateH`.
That is deferred until a real adopter needs byte-exact ordering past the
tracked head-parity heads.

## Deferred Follow-up

The explicit parity follow-up work is tracked in `TODO.md`.
