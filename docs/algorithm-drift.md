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
2. result ordering can still shift for near-tie candidates
3. mutation testing shows this area is still more brittle than the core scoring path

### 2. `segtok` replacement

Upstream YAKE relies on Python tokenization and sentence splitting behavior that is influenced by `segtok`.

Yaket replaces this with a Unicode-aware JS implementation.

Known consequences:

1. contractions, abbreviations, and punctuation may split differently
2. multilingual and Unicode-heavy texts may drift more than English prose
3. exact token boundaries can differ even when high-level results remain close

### 3. Floating-point differences

Yaket and Python YAKE can differ in tiny score rounding details across runtimes.

This is why some tests use a very small score tolerance instead of strict equality.

## What Is Not A Drift Point

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

## Current Position

On the checked-in Komoroske benchmark:

- Yaket and Python YAKE overlap strongly
- Yaket is materially closer to upstream YAKE than the old Bobbin baseline

## Deferred Follow-up

The explicit parity follow-up work is tracked in `TODO.md`.
