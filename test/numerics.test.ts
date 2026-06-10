import { describe, expect, it } from "vitest";

import { numpyPairwiseSum } from "../src/numerics.js";

/**
 * Bit-exact regression tests for the numpy pairwise summation port.
 *
 * Each `expected` value was captured from CPython 3.11 with `numpy.sum`
 * on the same input array. The point of this kernel is to match those
 * values exactly so `DataCore.buildSingleTermsFeatures` produces the
 * same `avgTf` and `stdTf` as Python YAKE — float-precision drift here
 * propagates straight into final candidate scores.
 */
describe("numpyPairwiseSum", () => {
  it("returns 0 for an empty input", () => {
    expect(numpyPairwiseSum([])).toBe(0);
  });

  it("returns the single element for a one-element input", () => {
    expect(numpyPairwiseSum([42])).toBe(42);
    expect(numpyPairwiseSum([-0.5])).toBe(-0.5);
  });

  it("uses naive accumulation below the unroll threshold (n < 8)", () => {
    // Below 8 elements numpy itself uses a naive loop, so naive and
    // pairwise must agree on these short inputs.
    expect(numpyPairwiseSum([1, 2, 3, 4, 5])).toBe(15);
    expect(numpyPairwiseSum([0.1, 0.1, 0.1])).toBeCloseTo(0.30000000000000004, 16);
  });

  it("matches numpy's sum on the Portuguese parity sample", () => {
    // valid_tfs collected from the upstream test_n3_PT sample. The 69
    // tf values produce sum=86, mean=1.2463768115942029 in numpy.
    const tfs = [3, 3, 1, 1, 1, 1, 3, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1];
    expect(tfs).toHaveLength(69);
    expect(numpyPairwiseSum(tfs)).toBe(86);

    const mean = numpyPairwiseSum(tfs) / tfs.length;
    expect(mean).toBe(1.2463768115942029);

    const squaredDeltas = tfs.map((value) => (value - mean) ** 2);
    // numpy: float(np.array(squaredDeltas).sum()) == 26.811594202898547
    expect(numpyPairwiseSum(squaredDeltas)).toBe(26.811594202898547);

    const std = Math.sqrt(numpyPairwiseSum(squaredDeltas) / tfs.length);
    expect(std).toBe(0.6233569034088859);
  });

  it("matches numpy on a 200-element synthetic input that exercises the recursive split", () => {
    // 200 > 128 (PAIRWISE_BLOCK_SIZE), so this hits the recursive halving
    // branch. Each element is a small float that drifts measurably under
    // naive accumulation; the inputs are deterministic integer-derived
    // floats (not `Math.sin`) so they are bit-identical across V8 and
    // CPython.
    const xs: number[] = [];
    for (let index = 0; index < 200; index += 1) {
      xs.push((index + 1) / 7);
    }
    // captured by `float(np.array([(i+1)/7 for i in range(200)]).sum())`
    expect(numpyPairwiseSum(xs)).toBe(2871.4285714285716);
  });

  it("matches numpy on a 16-element input at the unrolled-block path", () => {
    // 8 ≤ 16 ≤ 128 → unrolled path with no tail and no recursion.
    const xs = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 10.1, 11.2, 12.3, 13.4, 14.5, 15.6, 16.7];
    // captured by `float(np.array(xs).sum())` → 143.3
    expect(numpyPairwiseSum(xs)).toBe(143.3);
  });

  it("matches numpy on a 13-element input that exercises the unrolled tail", () => {
    // 13 = 8 + 5 tail → 8 unrolled accumulators plus the loose tail.
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    expect(numpyPairwiseSum(xs)).toBe(91);
  });

  it("matches numpy bit-exactly even when summation order causes catastrophic cancellation", () => {
    // 1e16 plus 99 ones cannot be represented exactly in float64 — the
    // ULP of 1e16 is 2, so each "+1" can be lost in naive accumulation.
    // The kernel must match numpy's specific 8-accumulator order, which
    // matters because forward and reversed orders land on different
    // representable values (10000000000000084 vs 10000000000000100).
    const xs: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      xs.push(index === 0 ? 1e16 : 1);
    }
    // captured by `float(np.array(xs).sum())` and the reversed case.
    expect(numpyPairwiseSum(xs)).toBe(10000000000000084);
    expect(numpyPairwiseSum([...xs].reverse())).toBe(10000000000000100);
  });
});
