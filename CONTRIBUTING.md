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
```

## Contribution Guidelines

1. Prefer the smallest correct change.
2. Preserve deterministic output ordering unless there is a very clear reason to change it.
3. Add regression tests for any bug fix or parity difference you address.
4. Keep Bobbin-specific logic out of the extraction core unless it is truly reusable.
5. Update documentation when public behavior changes.

## Pull Request Notes

Useful things to include in a PR description:

1. what changed
2. why it changed
3. whether ranking or dedup behavior changed
4. what tests or benchmarks were run
