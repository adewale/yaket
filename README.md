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

Deferred for later parity work:

- CLI
- text highlighting
- lemmatization
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

## API Notes

- Lower scores are better, matching YAKE.
- Results are returned in deterministic order for stable inputs.
- Stopword lists are bundled at build time; no runtime filesystem reads are required.
- The implementation currently aims to match upstream Python YAKE core behavior, not the modified behavior of `yake-wasm`.

## Development

```bash
npm install
npm test
npm run build
```

`test/python-parity.test.ts` performs a live comparison against the Python reference implementation when `PYTHONPATH` points at an upstream YAKE checkout. The default path used during local development is `/tmp/yake`.

## Roadmap

See `docs/roadmap.md` for:

- parity gaps versus upstream Python YAKE
- architectural changes for pluggable ingestion-pipeline use
- testing and verification strategy
- planned TF-IDF benchmark work on the Komoroske dataset
