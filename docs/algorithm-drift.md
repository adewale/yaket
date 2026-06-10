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
- the upstream `test_n3_PT` Portuguese sample now exact-matches the upstream YAKE top-20 by candidate name (locked in `test/multilingual-parity.test.ts`). Some scores still differ by 1 ULP because `Math.log` is not bit-identical between V8 and glibc, but the residual is below the comparator's tie-break tolerance.
- single-paragraph multilingual parity heads for `de`, `es`, `fr`, `it`, `nl`, `ru` are exact-match against upstream YAKE on the tracked samples; `es` extended from 9/10 to a full 12/12 match.
- `ar` matches the head 1-2 exactly. Positions 3-5 share byte-identical `h` in Yaket and need bit-exact log to order with upstream.

The 2026-06-10 parity work closed the historic Portuguese mid-rank gap through two changes:

1. **segtok sentence-merge parity.** `splitSentences` now joins across a terminal whose preceding character is whitespace, matching segtok's `_abbreviation_joiner` rule that treats `Arquivo.pt . Nesta` as a single sentence. This fixed the residual `wspread`/`wpos` drift on `ricardo` and pulled "Ricardo Campos investigador" into position 16, exactly where upstream ranks it.
2. **`isSlidingNgramTie` reversal removed.** The reversal was a heuristic that helped one synthetic four-word example (`"Google Kaggle data science"`) but reversed three real-world multilingual cases. Ties now uniformly fall to insertion order, mirroring Python's `sorted(..., key=lambda c: c.h)` stable behavior.
3. **numpy-compatible pairwise summation.** Yaket now ports numpy's unrolled 8-accumulator pairwise sum kernel for `avgTf` and `stdTf` (`src/numerics.ts`). The previous naive accumulator produced a 3-ULP drift on `stdTf` for the 69-element Portuguese sample, which then propagated through `wfreq` into final candidate scores. The Bobbin newsletter golden now scores bit-identically with upstream Python YAKE.

Earlier headline fix that closed the major Portuguese drift before any of those: trailing periods are no longer attached to a token when the only thing that follows is a sentence closer (e.g. `Histórias."` at the end of a sentence). This matches segtok behavior and removed duplicate `Histórias.` / `Conta-me Histórias.` candidates that crowded out upstream-ranked entries.

### Float-precision residuals (Arabic positions 3-5)

The Arabic top-12 contains the same 12 candidates as upstream Python
YAKE, in the same order at every position except 3-5. There the three
trigrams (`الآلي والذكاء الاصطناعي`, `والذكاء الاصطناعي يحولان`,
`الاصطناعي يحولان الصناعة`) score byte-identically in Yaket
(`0.030304526071711916`) while upstream computes 1-3 ULP-different
floats and stable-sorts them in a non-positional order. No positional
heuristic can reproduce upstream's ordering without bit-exact float
math.

Practically, this is **not** an algorithm bug — Yaket's parity
guarantee at the tied positions is "same candidates, ordering within
the tie is implementation-defined". The multilingual parity test asserts
exactly that: positions 3-5 are pinned as a `tiedBuckets` range whose
set must equal upstream's, while every other position is asserted in
exact upstream order. Failures still surface immediately if the
candidate set ever diverges; spurious ordering noise from V8 ↔ glibc
log drift no longer trips the test.

The single remaining source of bit drift is `Math.log`. V8 and glibc both
ship fdlibm-derived log implementations but use different polynomial
coefficients, so `Math.log(3)` is 1 ULP apart between the two runtimes.
That ULP propagates through `wcase = max(tfA, tfN) / (1 + log(tf))` and
`wpos = log(log(3 + median(occurs)))` and can land in or out of the
comparator's 1e-15 tolerance depending on the surrounding arithmetic.

A full fix would require porting glibc's `log` implementation
(`sysdeps/ieee754/dbl-64/e_log.c`) into the scoring path. That is
deferred until a real adopter needs byte-exact ordering past the tracked
heads.

## Deferred Follow-up

The explicit parity follow-up work is tracked in `TODO.md`.
