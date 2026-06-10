/**
 * Bit-exact port of numpy's pairwise summation kernel.
 *
 * numpy.core uses unrolled pairwise summation inside `umr_sum` (the reduce
 * implementation behind `ndarray.sum()` and `ndarray.mean()`). The kernel
 * has measurably better roundoff than naive left-to-right accumulation
 * because partial sums grow at roughly the same magnitude as their
 * neighbors before being combined.
 *
 * Upstream Python YAKE relies on numpy through `valid_tfs.mean()` and
 * `valid_tfs.std()` in `DataCore.build_single_terms_features`. The naive
 * accumulator Yaket previously used produced a 3-ULP drift on `std_tf`
 * for the 69-element Portuguese parity sample, which then propagated into
 * `wfreq` and finally into final candidate scores. Porting the numpy
 * kernel closes that propagation at the source.
 *
 * Reference: `numpy/_core/src/umath/loops_arithmetic.dispatch.c.src`,
 * function `pairwise_sum_*`. Behavior (per numpy main):
 *  - n <  8           : naive left-to-right sum
 *  - 8 ≤ n ≤ 128      : eight independent accumulators step 8 at a time,
 *                       then `((r0+r1)+(r2+r3))+((r4+r5)+(r6+r7))` plus
 *                       a naive tail for `n % 8`
 *  - n  > 128         : split at the largest multiple of 8 not exceeding
 *                       `n/2` and recurse
 *
 * This matters specifically for upstream parity. For very large arrays
 * (millions of elements) the kernel still has bounded O(log n) error
 * growth, which is the property numpy is after.
 */
const PAIRWISE_BLOCK_SIZE = 128;
const PAIRWISE_UNROLL = 8;

export function numpyPairwiseSum(values: readonly number[]): number {
  return pairwiseSumRange(values, 0, values.length);
}

function pairwiseSumRange(values: readonly number[], start: number, length: number): number {
  if (length < PAIRWISE_UNROLL) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += values[start + index]!;
    }
    return sum;
  }

  if (length <= PAIRWISE_BLOCK_SIZE) {
    const accumulators: number[] = [
      values[start]!,
      values[start + 1]!,
      values[start + 2]!,
      values[start + 3]!,
      values[start + 4]!,
      values[start + 5]!,
      values[start + 6]!,
      values[start + 7]!,
    ];

    const blockEnd = length - (length % PAIRWISE_UNROLL);
    for (let index = PAIRWISE_UNROLL; index < blockEnd; index += PAIRWISE_UNROLL) {
      accumulators[0] = accumulators[0]! + values[start + index]!;
      accumulators[1] = accumulators[1]! + values[start + index + 1]!;
      accumulators[2] = accumulators[2]! + values[start + index + 2]!;
      accumulators[3] = accumulators[3]! + values[start + index + 3]!;
      accumulators[4] = accumulators[4]! + values[start + index + 4]!;
      accumulators[5] = accumulators[5]! + values[start + index + 5]!;
      accumulators[6] = accumulators[6]! + values[start + index + 6]!;
      accumulators[7] = accumulators[7]! + values[start + index + 7]!;
    }

    let result = ((accumulators[0]! + accumulators[1]!) + (accumulators[2]! + accumulators[3]!))
      + ((accumulators[4]! + accumulators[5]!) + (accumulators[6]! + accumulators[7]!));

    for (let index = blockEnd; index < length; index += 1) {
      result += values[start + index]!;
    }

    return result;
  }

  let half = Math.floor(length / 2);
  half -= half % PAIRWISE_UNROLL;
  return pairwiseSumRange(values, start, half) + pairwiseSumRange(values, start + half, length - half);
}
