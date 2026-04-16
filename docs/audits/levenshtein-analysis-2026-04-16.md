# Levenshtein Analysis

Date: `2026-04-16`

This note analyzes how Yaket uses Levenshtein similarity relative to the published YAKE references and the upstream Python implementation.

## Sources used

1. `yake` upstream README citation section
2. upstream Python implementation in `/tmp/yake/yake/core/yake.py`
3. upstream Python Levenshtein helper in `/tmp/yake/yake/core/Levenshtein.py`
4. paper metadata for:
   - Campos et al. (2020), *YAKE! Keyword extraction from single documents using multiple local features*, Information Sciences 509, 257-289, DOI `10.1016/j.ins.2019.09.013`

## Main conclusion

In both upstream YAKE and Yaket, Levenshtein is **not part of the keyword scoring features themselves**.

Instead, it is used as an **optional post-ranking deduplication similarity function**.

That means:

1. candidate generation and scoring are driven by local statistical features
2. deduplication is a later filtering step over ranked candidates
3. Levenshtein affects final list cleanup only when users choose `levs`/`leve`

## Comparison with upstream Python YAKE

Upstream Python YAKE exposes three dedup functions:

- `seqm`
- `jaro`
- `levs`

The current Yaket public API mirrors that shape.

Current default behavior also matches upstream:

- default dedup function is `seqm`
- Levenshtein is available but optional

## Comparison with the paper-level algorithm description

The paper positions YAKE as a feature-based single-document keyword extraction method.
The key scoring behavior is driven by local features such as casing, frequency, position, spread, and co-occurrence-derived terms.

Based on the upstream implementation and references:

- Levenshtein belongs to the duplicate-removal layer
- it is not a core ranking feature in the main YAKE score

So Yaket's architectural placement of Levenshtein is aligned with the paper and the reference implementation.

## Current Yaket behavior

Yaket now uses an exact Levenshtein distance for the exported helper and for `levs` similarity.

That means:

1. `Levenshtein.distance(a, b)` is a true edit distance
2. `Levenshtein.ratio(a, b)` is normalized by the longer string length
3. `levenshteinSimilarity()` matches that ratio shape

## Remaining caveat

The main approximation in Yaket's dedup layer is now `seqm`, not `levs`.

That is already documented elsewhere and remains the more important parity gap for dedup behavior.

## Practical guidance

If you want closest parity with the current upstream default behavior:

1. keep `dedupFunc: "seqm"`
2. keep `dedupLim` aligned with upstream settings

If you want a simpler and more interpretable dedup function:

1. use `dedupFunc: "levs"`
2. understand that this changes dedup semantics away from upstream default behavior
