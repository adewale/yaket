# Yaket

`Yaket` is a standalone TypeScript port of the YAKE core keyword extraction pipeline.

## Scope

Implemented now:

- `KeywordExtractor`
- `DataCore`
- `SingleWord`
- `ComposedWord`
- text preprocessing, sentence splitting, tokenization, and `getTag`
- Levenshtein and dedup similarity helpers
- bundled multilingual stopword assets
- regression fixtures and Python parity checks
- Bobbin-compatible adapter export
- document-oriented extraction helpers for ingestion pipelines
- optional lemmatizer hook
- text highlighter utility
- CLI entry point
- browser/worker-safe package entry points

Deferred for later parity work:

- broader upstream corpus parity coverage

## Install

```bash
npm install yaket
```

## Usage

```ts
import { KeywordExtractor } from "yaket";

const extractor = new KeywordExtractor({
  lan: "en",
  n: 3,
  top: 10,
});

const keywords = extractor.extractKeywords(
  "Google is acquiring data science community Kaggle.",
);

console.log(keywords);
```

The package also exposes a convenience function:

```ts
import { extractKeywords } from "yaket";

const keywords = extractKeywords("Machine learning is transforming search.", {
  lan: "en",
  n: 2,
  top: 5,
});
```

For pipeline-oriented code, the document helpers keep your own document IDs and metadata attached:

```ts
import { extractFromDocument } from "yaket";

const result = extractFromDocument({
  id: "doc-1",
  language: "en",
  title: "Edge runtimes",
  body: "Cloudflare Workers process requests close to users.",
});
```

For Bobbin-compatible adoption, use the wrapper that preserves the existing call shape:

```ts
import { extractYakeKeywords } from "yaket";

const keywords = extractYakeKeywords("Platform ecosystems reward integration.", 5, 3);
```

To highlight extracted keywords in text:

```ts
import { TextHighlighter, extractKeywords } from "yaket";

const keywords = extractKeywords("Machine learning improves software delivery.");
const highlighted = new TextHighlighter().highlight(
  "Machine learning improves software delivery.",
  keywords,
);
```

To experiment with custom normalization, you can provide a lemmatizer hook:

```ts
import { extractKeywordDetails } from "yaket";

const details = extractKeywordDetails("models model models", {
  n: 1,
  lemmatizer: {
    lemmatize(token) {
      return token.endsWith("s") ? token.slice(0, -1) : token;
    },
  },
});
```

## CLI

```bash
yaket --text-input "Google is acquiring Kaggle" --language en --ngram-size 3 --top 5 --verbose
```

## API Notes

- Lower scores are better, matching YAKE.
- Results are returned in deterministic order for stable inputs.
- Stopword lists are bundled at build time; no runtime filesystem reads are required.
- The implementation currently aims to match upstream Python YAKE core behavior, not the modified behavior of `yake-wasm`.
- The extraction path is kept free of Node-only runtime dependencies so it can be bundled for Cloudflare Workers and browser-style runtimes.

## Development

```bash
npm install
npm test
npm run build
npm run benchmark
```

`test/python-parity.test.ts` performs a live comparison against the Python reference implementation when `PYTHONPATH` points at an upstream YAKE checkout. The default path used during local development is `/tmp/yake`.

## Roadmap

See `docs/roadmap.md` for:

- parity gaps versus upstream Python YAKE
- architectural changes for pluggable ingestion-pipeline use
- testing and verification strategy
- planned TF-IDF benchmark work on the Komoroske dataset
- Bobbin and generic ingestion-pipeline integration guides

Current benchmark snapshot:

- `docs/benchmarks/komoroske-2026-04-06.md`
