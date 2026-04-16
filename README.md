# Yaket

`Yaket` is a TypeScript keyword extraction library that ports the core YAKE pipeline into a form that works in Node, browser-style bundles, and Cloudflare Workers.

It is designed for teams that want upstream-like YAKE behavior, deterministic results, and a typed API that can plug into ingestion pipelines such as [Bobbin](https://github.com/adewale/bobbin) or future consumers such as `flux-search`.

## Attribution

Yaket is an independent TypeScript port/reimplementation of the YAKE approach and is based on the upstream Python YAKE project:

- Original project: [INESCTEC/yake](https://github.com/INESCTEC/yake)

The underlying research is:

- Ricardo Campos, Vitor Mangaravite, Arian Pasquali, Alipio Jorge, Celine N. S. Santos, and Adam Jatowt.
  *YAKE! Keyword Extraction from Single Documents using Multiple Local Features*.
  Information Sciences 509 (2020), 257-289.
  DOI: [`10.1016/j.ins.2019.09.013`](https://doi.org/10.1016/j.ins.2019.09.013)

Yaket aims to preserve the core YAKE behavior where practical, while adapting the implementation to JavaScript/TypeScript runtimes and edge-compatible packaging.

## Why use it

- **Upstream-shaped YAKE core**: `KeywordExtractor`, `DataCore`, `SingleWord`, `ComposedWord`, and the core scoring/dedup flow are implemented in TypeScript.
- **Edge-safe extraction path**: stopwords are bundled, and the extraction core avoids Node-only runtime dependencies.
- **Pipeline-friendly API**: one-shot extraction, reusable extractor instances, [Bobbin](https://github.com/adewale/bobbin)-compatible adapter output, and document-oriented helpers are all available.
- **Verification-heavy**: regression fixtures, Python parity checks, property-based tests, Cloudflare runtime tests, and a benchmark harness are checked in.

## 30-Second Summary

Yaket extracts weighted keywords from a single document using a YAKE-style local-feature pipeline.

It is designed for cases where you want:

1. a deterministic keyword extractor
2. no LLM dependency
3. browser/edge compatibility
4. a practical JavaScript alternative to the Python YAKE package

## Quick Start

> Requires Node.js 20+

```bash
npm install @ade_oshineye/yaket
```

```ts
import { extract } from "@ade_oshineye/yaket";

const keywords = extract(
  "Google is acquiring data science community Kaggle.",
  { language: "en", n: 3, top: 5 },
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

Install from npm:

```bash
npm install @ade_oshineye/yaket
```

The package ships ESM output and exposes Worker/browser-safe entry points:

- `@ade_oshineye/yaket`
- `@ade_oshineye/yaket/browser`
- `@ade_oshineye/yaket/worker`

## Usage

## Algorithm Summary

At a high level, Yaket:

1. preprocesses text into sentences and tokens
2. generates single-word and multi-word candidates up to `n`
3. scores single words using local YAKE-style features such as frequency, spread, position, casing, and co-occurrence-derived relations
4. scores composed phrases from those single-word scores
5. deduplicates the ranked list with `seqm`, `levs`, or `jaro`

See `docs/architecture.md` for the pipeline structure and `docs/algorithm-drift.md` for known deviations from upstream YAKE.

## Options Reference

Common options:

| Option | Meaning | Default |
|---|---|---|
| `language` | language code | `en` |
| `n` | maximum n-gram size | `3` |
| `top` | number of results to return | `20` |
| `dedupFunc` | dedup function (`seqm`, `levs`, `jaro`) | `seqm` |
| `dedupLim` | dedup threshold | `0.9` |
| `windowSize` | co-occurrence window | `1` |
| `stopwords` | explicit stopword iterable override | bundled set for `lan` |

For the complete public API, see `docs/api-reference.md`.

Canonical option names are:

- `language`
- `dedupLim`
- `dedupFunc`
- `windowSize`

Legacy aliases such as `lan`, `dedup_lim`, `windowsSize`, and `window_size` are still accepted for backward compatibility, but new code should prefer the canonical names.

If you prefer the most concise one-shot API, `extract()` is an alias for `extractKeywords()`.

### Reusable extractor

```ts
import { KeywordExtractor } from "@ade_oshineye/yaket";

const extractor = new KeywordExtractor({
  language: "en",
  n: 3,
  top: 10,
});

const keywords = extractor.extractKeywords(
  "Cloudflare Workers process requests close to users.",
);
```

### Detailed keyword results

```ts
import { extractKeywordDetails } from "@ade_oshineye/yaket";

const details = extractKeywordDetails("Machine learning improves software delivery.", {
  language: "en",
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
import { extractFromDocument } from "@ade_oshineye/yaket";

const result = extractFromDocument({
  id: "doc-1",
  language: "en",
  title: "Edge runtimes",
  body: "Cloudflare Workers process requests close to users.",
});
```

### [Bobbin](https://github.com/adewale/bobbin)-compatible adapter

```ts
import { extractYakeKeywords } from "@ade_oshineye/yaket";

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
import { extractKeywordDetails } from "@ade_oshineye/yaket";

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
- `SingleWordScorer`
- `MultiWordScorer`
- `KeywordScorer`
- `candidateFilter`

Yaket also exports:

- `YakeResult`
- `YakeOptions`

The two first-class internal scoring hooks are:

1. `singleWordScorer` for replacing the internal YAKE single-word score formula
2. `multiWordScorer` for replacing the internal YAKE multi-word score formula

Example:

```ts
import { extractKeywordDetails } from "@ade_oshineye/yaket";

const details = extractKeywordDetails("agent swarms coordinate teams", {
  language: "en",
  n: 2,
  multiWordScorer: {
    score(candidate) {
      return candidate.size === 2 ? 0.001 : 10;
    },
  },
});
```

### Stopwords and languages

```ts
import { STOPWORDS, getStopwordText, supportedLanguages } from "@ade_oshineye/yaket";

console.log(supportedLanguages.includes("en"));
console.log(getStopwordText("en").split("\n").length > 0);
console.log(STOPWORDS.en.includes("the"));
```

Language lookup uses the first two letters of the requested language code.
If a specific stopword list is unavailable, Yaket currently resolves to an empty stopword list.

To extend or replace stopwords without mutating global state:

```ts
import { createStaticStopwordProvider, createStopwordSet } from "@ade_oshineye/yaket";

const stopwords = createStopwordSet("en", { add: ["yaket"], remove: ["the"] });

const provider = createStaticStopwordProvider({
  en: stopwords,
  pt: ["um", "uma"],
});
```

`STOPWORDS` is exported as a frozen map of bundled raw stopword text for users who want direct access to the packaged lists.

### Highlighting

```ts
import { TextHighlighter, extractKeywords } from "@ade_oshineye/yaket";

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

Additional dataset-oriented benchmark support is available for Inspec and SemEval-style evaluation via `scripts/benchmark-datasets.ts`.

```bash
npm run benchmark:datasets
```

Run it with:

```bash
npm run benchmark
```

## Architecture

- Architecture overview: `docs/architecture.md`
- API reference: `docs/api-reference.md`
- Use cases: `docs/use-cases.md`
- Algorithm drift: `docs/algorithm-drift.md`
- Dataset benchmarks: `docs/benchmarks/inspec-semeval.md`
- [Bobbin](https://github.com/adewale/bobbin) integration guide: `docs/integrations/bobbin.md`
- Generic pipeline guide: `docs/integrations/pipelines.md`
- Releasing guide: `docs/releasing.md`
- Contributing: `CONTRIBUTING.md`
- Roadmap: `docs/roadmap.md`
- Deferred work: `TODO.md`
- Audit notes: `docs/audits/implementation-audit-2026-04-16.md`

## Limitations

- The tokenizer is close to YAKE, but still not a literal `segtok` port.
- Dedup `seqm` behavior is still approximate rather than a byte-for-byte Python clone.
- Multilingual support exists through bundled stopwords, but broad multilingual parity coverage is deferred.
- [Bobbin's](https://github.com/adewale/bobbin) full topic-layer integration test suite is deferred and tracked in `TODO.md`.

## Comparison To Alternatives

| Tool | Strength | Tradeoff vs Yaket |
|---|---|---|
| TF-IDF | simple, cheap, corpus-aware | less phrase-aware and less YAKE-like on single documents |
| RAKE | simple phrase extraction | weaker local-feature scoring and usually cruder ranking |
| KeyBERT | embedding-based semantic relevance | larger dependency/runtime cost and often slower |
| Yaket | deterministic YAKE-style local-feature extraction in JS | still has some drift from upstream Python YAKE in tokenization and some heuristic edge cases |

For a concrete checked-in comparison, see the Komoroske benchmark report.

## Main Use Cases

Yaket is especially well-suited for:

1. blog/CMS/knowledge-base tagging
2. newsletter and article topic extraction
3. search indexing and hybrid retrieval metadata
4. RAG chunk enrichment without an LLM call
5. browser extensions and client-side page analysis
6. chat and Slack bot topic tagging

See `docs/use-cases.md` for more detail.

## Live Demo

An interactive demo page lives in `demo/index.html` and is intended to be served through GitHub Pages.

GitHub Pages URL:

- `https://adewale.github.io/yaket/`

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
