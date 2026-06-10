import { describe, expect, it } from "vitest";

import { compareCandidates } from "../src/KeywordExtractor.js";

function candidate(uniqueKw: string, size: number, h: number, order: number) {
  return { uniqueKw, size, h, order };
}

describe("candidate ordering helpers", () => {
  it("orders by score first with insertion order as the stable tie-break", () => {
    // Score disagreement above 1e-15 tolerance is the dominant signal.
    expect(compareCandidates(
      candidate("alpha", 1, 0.1, 10),
      candidate("beta", 1, 0.2, 0),
    )).toBeLessThan(0);

    expect(compareCandidates(
      candidate("alpha", 1, 0.2, 10),
      candidate("beta", 1, 0.1, 0),
    )).toBeGreaterThan(0);

    // Exact score ties fall to insertion order.
    expect(compareCandidates(
      candidate("alpha", 1, 0.1, 0),
      candidate("beta", 1, 0.1, 1),
    )).toBeLessThan(0);

    // Sliding-trigram cases used to flip insertion order. They no longer do
    // — the heuristic helped one synthetic 4-word case but regressed the
    // Portuguese / Spanish / Arabic multilingual parity samples. See
    // `docs/algorithm-drift.md` and the 2026-06-10 commit history.
    expect(compareCandidates(
      candidate("google kaggle data", 3, 0.1, 0),
      candidate("kaggle data science", 3, 0.1, 1),
    )).toBeLessThan(0);
  });

  it("treats float-precision drift within 1e-15 as a tie that yields to insertion order", () => {
    // V8 vs glibc `Math.log` differences propagate into final scores as 1-3
    // ULP drift. The comparator collapses anything within 1e-15 to a tie so
    // platform-dependent rounding never reorders the head.
    expect(compareCandidates(
      candidate("first", 2, 0.1, 0),
      candidate("second", 2, 0.1 + 5e-17, 1),
    )).toBeLessThan(0);

    expect(compareCandidates(
      candidate("first", 2, 0.1 + 5e-17, 0),
      candidate("second", 2, 0.1, 1),
    )).toBeLessThan(0);
  });
});
