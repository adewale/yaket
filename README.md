# Yaket

`Yaket` is a TypeScript keyword extraction library that ports the core YAKE pipeline into a form that works in Node, browser-style bundles, and Cloudflare Workers.

It is designed for teams that want upstream-like YAKE behavior, deterministic results, and a typed API that can plug into ingestion pipelines such as [Bobbin](https://github.com/adewale/bobbin) or future consumers such as `flux-search`.

## Why use it

- **Upstream-shaped YAKE core**: `KeywordExtractor`, `DataCore`, `SingleWord`, `ComposedWord`, and the core scoring/dedup flow are implemented in TypeScript.
- **Edge-safe extraction path**: stopwords are bundled, and the extraction core avoids Node-only runtime dependencies.
- **Pipeline-friendly API**: one-shot extraction, reusable extractor instances, [Bobbin](https://github.com/adewale/bobbin)-compatible adapter output, and document-oriented helpers are all available.
- **Verification-heavy**: regression fixtures, Python parity checks, property-based tests, Cloudflare runtime tests, and a benchmark harness are checked in.

## Quick Start

> Requires Node.js 20+

```bash
npm install yaket
```

```ts
import { extractKeywords } from "yaket";

const keywords = extractKeywords(
  "Google is acquiring data science community Kaggle.",
  { lan: "en", n: 3, top: 5 },
);

console.log(keywords);
```

Expected shape:

```ts
[
  ["science community Kaggle", 0.022868570857866696],
  ["community Kaggle", 0.04778970771086575],
]
```

## Installation

```bash
npm install yaket
```

The package ships ESM output and exposes Worker/browser-safe entry points:

- `yaket`
- `yaket/browser`
- `yaket/worker`

## Usage

### Reusable extractor

```ts
import { KeywordExtractor } from "yaket";

const extractor = new KeywordExtractor({
  lan: "en",
  n: 3,
  top: 10,
});

const keywords = extractor.extractKeywords(
  "Cloudflare Workers process requests close to users.",
);
```

### Detailed keyword results

```ts
import { extractKeywordDetails } from "yaket";

const details = extractKeywordDetails("Machine learning improves software delivery.", {
  lan: "en",
  n: 2,
  top: 5,
});
```

`extractKeywordDetails()` returns:

```ts
type KeywordResult = {
  keyword: string;
  normalizedKeyword: string;
  score: number;
  ngramSize: number;
  occurrences: number;
  sentenceIds: number[];
};
```

### Document-oriented pipelines

```ts
import { extractFromDocument } from "yaket";

const result = extractFromDocument({
  id: "doc-1",
  language: "en",
  title: "Edge runtimes",
  body: "Cloudflare Workers process requests close to users.",
});
```

### [Bobbin](https://github.com/adewale/bobbin)-compatible adapter

```ts
import { extractYakeKeywords } from "yaket";

const keywords = extractYakeKeywords(
  "Platform ecosystems reward integration.",
  5,
  3,
);
```

This preserves [Bobbin's](https://github.com/adewale/bobbin) current output shape:

```ts
type BobbinYakeResult = {
  keyword: string;
  score: number;
};
```

### Custom hooks

```ts
import { extractKeywordDetails } from "yaket";

const details = extractKeywordDetails("models model models", {
  n: 1,
  candidateNormalizer: {
    normalize(token) {
      return token.endsWith("s") ? token.slice(0, -1) : token;
    },
  },
  lemmatizer: {
    lemmatize(token) {
      return token;
    },
  },
});
```

Available extension points:

- `TextProcessor`
- `StopwordProvider`
- `SimilarityStrategy`
- `CandidateNormalizer`
- `Lemmatizer`
- `KeywordScorer`
- `candidateFilter`

### Stopwords and languages

```ts
import { getStopwordText, supportedLanguages } from "yaket";

console.log(supportedLanguages.includes("en"));
console.log(getStopwordText("en").split("\n").length > 0);
```

Language lookup uses the first two letters of the requested language code.
If a specific stopword list is unavailable, Yaket currently resolves to an empty stopword list.

### Highlighting

```ts
import { TextHighlighter, extractKeywords } from "yaket";

const keywords = extractKeywords("Machine learning improves software delivery.");
const highlighted = new TextHighlighter().highlight(
  "Machine learning improves software delivery.",
  keywords,
);
```

## CLI

```bash
yaket --text-input "Google is acquiring Kaggle" --language en --ngram-size 3 --top 5 --verbose
```

Supported flags:

- `--text-input`
- `--input-file`
- `--language`
- `--ngram-size`
- `--dedup-func`
- `--dedup-lim`
- `--window-size`
- `--top`
- `--verbose`
- `--help`

## Cloudflare Compatibility

Yaket keeps the extraction core free of runtime filesystem access and Node-only extraction dependencies.

Verification currently includes:

- source guards for extraction modules
- browser-target bundling smoke tests
- a real Cloudflare Workers test lane via `@cloudflare/vitest-pool-workers`

Run it with:

```bash
npm run test:cloudflare
```

## Benchmarks

The repository includes a benchmark harness that compares:

- Yaket
- upstream Python YAKE
- the original [Bobbin](https://github.com/adewale/bobbin) YAKE-like implementation
- a simple TF-IDF baseline

Current checked-in report:

- `docs/benchmarks/komoroske-2026-04-06.md`

Run it with:

```bash
npm run benchmark
```

## Architecture

- Architecture overview: `docs/architecture.md`
- [Bobbin](https://github.com/adewale/bobbin) integration guide: `docs/integrations/bobbin.md`
- Generic pipeline guide: `docs/integrations/pipelines.md`
- Roadmap: `docs/roadmap.md`
- Deferred work: `TODO.md`
- Audit notes: `docs/audits/implementation-audit-2026-04-16.md`

## Limitations

- The tokenizer is close to YAKE, but still not a literal `segtok` port.
- Dedup `seqm` behavior is still approximate rather than a byte-for-byte Python clone.
- Multilingual support exists through bundled stopwords, but broad multilingual parity coverage is deferred.
- [Bobbin's](https://github.com/adewale/bobbin) full topic-layer integration test suite is deferred and tracked in `TODO.md`.

## Development

```bash
npm install
npm run typecheck
npm test
npm run test:cli:coverage
npm run test:cloudflare
npm run build
npm run check:package
npm run benchmark
npm run verify
```

`test/python-parity.test.ts` performs a live comparison against upstream Python YAKE when `PYTHONPATH` points at a YAKE checkout. The default path used during local development is `/tmp/yake`.

Mutation testing is configured via `Stryker` and can be run separately when you want a slower audit-focused pass:

```bash
npm run test:mutation
```

## When Not To Use Yaket

- If you need corpus-wide topic modeling rather than single-document keyword extraction.
- If you need production-grade lemmatization out of the box today.
- If exact upstream Python tokenization parity across all languages is a hard requirement right now.

## License

MIT
