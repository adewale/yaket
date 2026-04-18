# Algorithm Drift From Upstream YAKE

Yaket aims to stay close to the upstream Python YAKE implementation, but it is not a byte-for-byte port.

This document makes the known drift points explicit.

## Main Drift Areas

### 1. `seqm` dedup behavior

The upstream YAKE default dedup function is `seqm`.

Yaket now regression-tests representative `seqm` examples against the current upstream optimized similarity path.

However, `seqm` is still the biggest dedup parity risk because it is heuristic rather than a simple canonical metric.

Known consequences:

1. near-threshold dedup decisions can still differ in edge cases
2. mutation testing shows this area is still more brittle than the core scoring path

### 2. `segtok` replacement

Upstream YAKE relies on Python tokenization and sentence splitting behavior that is influenced by `segtok`.

Yaket replaces this with a Unicode-aware JS implementation.

Known consequences:

1. contractions, abbreviations, and punctuation may split differently
2. multilingual and Unicode-heavy texts may drift more than English prose
3. exact token boundaries can differ even when high-level results remain close

Recent parity work closed one concrete sentence-boundary gap for lowercase sentence starts, but broader tokenizer parity with `segtok` is still not finished.

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

The real remaining dedup risk is `seqm`, not substring dedup.

## How To Read Benchmark Results

When Yaket differs from upstream Python YAKE, interpret the difference in this order:

1. tokenization or sentence-boundary drift
2. `seqm` dedup drift
3. tiny floating-point drift
4. intentional API differences such as surface-form preservation

## Current Position

On the checked-in Komoroske benchmark:

- Yaket and Python YAKE overlap strongly
- Yaket is materially closer to upstream YAKE than the old Bobbin baseline

On the currently tracked upstream unit-test examples:

- the previously identified English near-tie ordering cases are fixed
- a Portuguese ranking drift remains in `test_n3_PT`

## Deferred Follow-up

The explicit parity follow-up work is tracked in `TODO.md`.
