# Contributing

Thanks for your interest in improving Yaket.

## Development Setup

```bash
git clone https://github.com/adewale/yaket.git
cd yaket
npm install
```

## Before Opening A Pull Request

Run the standard verification steps:

```bash
npm run typecheck
npm test
npm run test:cli:coverage
npm run test:cloudflare
npm run build
npm run check:package
```

If you are touching scoring, dedup, or parity-sensitive areas, also run:

```bash
npm run benchmark
npm run benchmark:multilingual   # if Python YAKE is available locally
```

The Python-parity tests (`test/python-parity.test.ts`,
`test/differential-fuzz.test.ts`, `test/multilingual-parity.test.ts`)
auto-skip when no upstream YAKE checkout is available. To run them
locally, point `YAKET_PYTHONPATH` at a YAKE checkout (the default is
`/tmp/yake`) and ensure `python3` can `import yake`. The benchmark
script falls back to "Python YAKE comparison unavailable" rather than
failing when the subprocess cannot import the module.

## Contribution Guidelines

1. Prefer the smallest correct change.
2. Preserve deterministic output ordering unless there is a very clear reason to change it.
3. Add regression tests for any bug fix or parity difference you address.
4. Use red-green-refactor TDD plus property-based tests (`fast-check`) for behavior-changing work — failing test first, minimal change to pass, then refactor.
5. Keep the extraction core free of Node-only dependencies (`fs`, `path`, `child_process`, native bindings). Node-only code lives in `src/cli.ts` and `scripts/`.
6. Keep Bobbin-specific logic out of the extraction core unless it is truly reusable.
7. Update documentation when public behavior changes.

## Pull Request Notes

Useful things to include in a PR description:

1. what changed
2. why it changed
3. whether ranking or dedup behavior changed
4. what tests or benchmarks were run
