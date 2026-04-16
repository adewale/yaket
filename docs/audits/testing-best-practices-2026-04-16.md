# Testing Best Practices Check

Date: `2026-04-16`

This review uses the guidance in `adewale/testing-best-practices/research`.

## Strong alignment

### Tier 1: Always required

Present:

1. unit tests through public interfaces
2. smoke/runtime tests
3. regression fixtures

### Tier 2: Required when applicable

Present:

1. property-based tests
2. documentation-code sync tests
3. contract/runtime checks for Worker compatibility
4. differential testing against upstream Python YAKE
5. benchmark tests for performance-sensitive behavior

### Additional strong patterns

Present:

1. mutation-style fuzzing over known-good fixtures
2. golden fixture tests with checked-in expected outputs
3. package-surface smoke tests
4. Cloudflare runtime tests on the actual target platform family

## Remaining improvements

1. Keep the Python parity lane mandatory in CI for releases.
2. Keep CLI coverage at 100% with the dedicated coverage job.
3. Use mutation testing periodically on scoring and dedup modules rather than on every normal verification run.

## Conclusion

The current Yaket suite is strongly aligned with the recommended testing strategy for a parser/scoring/ranking library with an upstream differential oracle.
