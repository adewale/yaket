# Mutation Testing Audit — 2026-04-26

Stryker mutation-testing run on the four scoring/dedup-critical source
files. Configuration: `coverageAnalysis: "perTest"`, vitest test runner,
no TypeScript checker (mutants that would fail typecheck fail at runtime
and count as killed).

## Summary

| File                        | Score (total) | Score (covered) | Killed | Timeout | Survived | No-cov |
|-----------------------------|--------------:|----------------:|-------:|--------:|---------:|-------:|
| All files                   | **68.77 %**   | 71.96 %         | 535    | 22      | 217      | 36     |
| `src/SingleWord.ts`         | 80.53 %       | 81.98 %         | 91     | 0       | 20       | 2      |
| `src/KeywordExtractor.ts`   | 72.82 %       | 78.53 %         | 150    | 0       | 41       | 15     |
| `src/ComposedWord.ts`       | 67.24 %       | 76.47 %         | 78     | 0       | 24       | 14     |
| `src/similarity.ts`         | 63.47 %       | 64.32 %         | 216    | 22      | 132      | 5      |

The total score is above the 60 % `break` threshold and below the 80 %
`high` threshold. The Stryker run took 8 minutes 20 seconds with 4
parallel test runners.

## Survivor breakdown by mutator

| Mutator               | Survivors |
|-----------------------|----------:|
| ConditionalExpression | 85        |
| EqualityOperator      | 34        |
| BlockStatement        | 30        |
| ArithmeticOperator    | 13        |
| StringLiteral         | 12        |
| MethodExpression      | 11        |
| LogicalOperator       | 9         |
| BooleanLiteral        | 8         |
| ArrayDeclaration      | 6         |
| AssignmentOperator    | 4         |
| Regex                 | 2         |
| ArrowFunction         | 2         |
| UnaryOperator         | 1         |

## Triage

The bulk of `src/similarity.ts` survivors (132 of 217) are
**equivalent mutants** — performance-optimization branches that do not
change behavior. The most common cases:

1. **Cache-hit short-circuits** (`if (cached != null) { return cached; }`).
   Removing the early return forces a recomputation that produces the
   same numeric value. No test can distinguish the two outcomes.
2. **Levenshtein length-symmetric swap** (`if (len1 > len2) { [seq1, seq2] = [seq2, seq1]; }`).
   The matrix algorithm is symmetric; swapping the inputs produces the
   identical distance.
3. **`simpleDistance` vs `matrixDistance` threshold** (`len1 <= 3`).
   Both algorithms return the same distance; the threshold is purely a
   speed optimization.
4. **Empty-input fast paths** (`if (cand1 === cand2)`, `if (maxLength === 0)`).
   The fall-through branch produces the same answer.

These were left as-is. Killing equivalent mutants requires either
restructuring the code to remove the optimization or asserting on
cache-state side effects (which would couple tests to implementation).

`src/KeywordExtractor.ts` survivors are more actionable. The 0.6
work-stream addressed the highest-value ones with two new test files:

- `test/keyword-extractor-defaults.test.ts` — pins each default
  configuration value (`language="en"`, `n=3`, `top=20`, `dedupLim=0.9`,
  `dedupFunc="seqm"`, `windowSize=1`, `features=null`) so the
  `?? "en"` / `?? 3` / etc. defaults are now mutation-killable.
- `test/dedup-boundaries.test.ts` — covers the dedup boundary
  conditions: `dedupLim >= 1` skips dedup entirely, `dedupLim < 1`
  applies strict-greater (`>`, not `>=`) comparison against the
  threshold, the early-exit branch for null/undefined/empty text, and
  the post-dedup truncation by `top`.

## What is not addressed and why

1. **Float-precision tie-break** (`compareCandidates` epsilon at
   `1e-15`). Mutating `>=` vs `>` here would not change behavior on the
   tracked corpus since ties at exactly 1e-15 do not arise. Fixing this
   would require either (a) setting up a synthetic ComposedWord pair
   with carefully crafted scores, or (b) relaxing the epsilon entirely
   to match Python's strict-`<` ordering — both deferred per
   `docs/algorithm-drift.md`.
2. **`isSlidingNgramTie` predicate** (`compareCandidates`). This branch
   is exercised by `test/reference.test.ts::matches upstream ordering
   for near-tie ngrams`, but several specific conditional flips inside
   it survive because they degrade to the same final ordering on the
   English corpus. The same float-precision investigation applies.
3. **`ComposedWord.updateH` stopword-weight `STOPWORD_WEIGHT === "bi"`
   branch.** Constant comparison; no current test toggles
   `STOPWORD_WEIGHT`.

## Re-running

```bash
npm run test:mutation
```

Reports land at `reports/mutation/mutation.json` and the clear-text
output at the end of the run. The configuration in `stryker.conf.json`
uses `coverageAnalysis: "perTest"` and has the TypeScript checker
disabled to keep the run inside ten minutes on commodity hardware.
