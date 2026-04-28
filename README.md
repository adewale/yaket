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
- **Surface-form preserving results**: returned `keyword` values keep the observed case from the source text, while `normalizedKeyword` carries the normalized matching form for downstream logic.
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
| `stopwords` | explicit stopword iterable override | bundled set for `language` |

For the complete public API, see `docs/api-reference.md`.

Canonical option names:

- `language`
- `dedupLim`
- `dedupFunc` — `seqm`, `levs`, or `jaro`
- `windowSize`

Yaket 0.6 dropped the snake_case aliases (`lan`, `dedup_lim`, `dedup_func`,
`windowsSize`, `window_size`), the `extract_keywords()` method, and the
dedup-function value aliases (`leve`, `jaro_winkler`, `sequencematcher`).
Existing 0.5.x consumers should follow `docs/migration-bobbin-0.6.md`.

If you prefer the most concise one-shot API, `extract()` is a re-export of `extractKeywords()`.

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

`keyword` preserves the source-text surface form; `normalizedKeyword` is the normalized comparison key used for deduplication and downstream matching.

### Document-oriented pipelines

```ts
import { extractFromDocument, serializeDocumentKeywordResult } from "@ade_oshineye/yaket";

const result = extractFromDocument({
  id: "doc-1",
  language: "en",
  title: "Edge runtimes",
  body: "Cloudflare Workers process requests close to users.",
});

const serialized = serializeDocumentKeywordResult(result);
```

Document helpers also support lightweight pipeline hooks:

- `beforeExtractText(text, context)` for pre-normalization before extraction
- `afterExtractKeywords(keywords, context)` for post-ranking pipeline shaping

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

- `TextProcessor` (combined `splitSentences` + `tokenizeWords` surface)
- `SentenceSplitter` (just `split(text) => string[]`, supplied via the `sentenceSplitter` option)
- `Tokenizer` (just `tokenize(text) => string[]`, supplied via the `tokenizer` option)
- `StopwordProvider`
- `SimilarityStrategy`
- `CandidateNormalizer`
- `Lemmatizer`
- `SingleWordScorer`
- `MultiWordScorer`
- `KeywordScorer`
- `candidateFilter`

`sentenceSplitter` and `tokenizer` can be supplied independently when you only
want to override one half of the text-processing pipeline. They take precedence
over a `textProcessor` for the half they cover, so the other half keeps the
bundled (or `textProcessor`-supplied) behavior.

`lemmatizer` stays hook-based in Yaket. Upstream-style string backends such as `"spacy"` or `"nltk"` are intentionally not implemented in the extraction core.

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

### Configurable similarity caches

`Yaket` memoizes similarity scores used by the `seqm`, `levs`, and `jaro`
dedup paths in bounded module-level caches. To isolate cache state — for
long-running edge workers, tests, or per-request caching — create your own
cache and pass it to a `KeywordExtractor` (or directly to a similarity
helper):

```ts
import {
  KeywordExtractor,
  createSimilarityCache,
  sequenceSimilarity,
} from "@ade_oshineye/yaket";

const cache = createSimilarityCache({ maxSize: 5_000 });

const extractor = new KeywordExtractor({
  language: "en",
  n: 3,
  top: 10,
  similarityCache: cache,
});

extractor.extractKeywords("Edge runtimes power modern serverless platforms.");

console.log(cache.stats()); // { distance, ratio, sequence, jaro }
cache.clear();

// Direct use is supported for callers wiring custom dedup logic.
sequenceSimilarity("alpha", "alpha", cache);
```

Each `SimilarityCache` owns four bounded `Map`s — one per helper:
`distance` and `ratio` for `Levenshtein`, `sequence` for `sequenceSimilarity`
(the `seqm` dedup path), and `jaro` for `jaroSimilarity`.

The module-level helpers `clearSimilarityCaches()` and
`getSimilarityCacheStats()` continue to operate on the default cache for
backwards compatibility.

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

Current checked-in reports:

- `docs/benchmarks/komoroske-2026-04-06.md`
- `docs/benchmarks/multilingual.md`

Additional dataset-oriented benchmark support is available for Inspec and SemEval-style evaluation via `scripts/benchmark-datasets.ts`.

```bash
npm run benchmark:datasets
```

A per-language Python-YAKE parity benchmark (English, German, Spanish, French, Italian, Portuguese, Dutch, Russian, Arabic) is available via:

```bash
npm run benchmark:multilingual
```

A bundle-size report (worker-target, ESM, gzipped) is available via:

```bash
npm run bundle-size
```

This is a Node-only script that uses esbuild and writes
`docs/benchmarks/bundle-size.md`. The `test/bundle-size.test.ts` test
asserts the gzipped bundle stays inside the documented edge budget.

Run it with:

```bash
npm run benchmark
```

## Architecture

- Architecture overview: `docs/architecture.md`
- API reference: `docs/api-reference.md`
- Use cases: `docs/use-cases.md`
- Algorithm drift: `docs/algorithm-drift.md`
- Lemmatization evaluation: `docs/lemmatization-evaluation.md`
- Bobbin / 0.5.x → 0.6 migration: `docs/migration-bobbin-0.6.md`
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
- Multilingual support covers 34 bundled stopword languages and head-parity locks against upstream Python YAKE 0.7.x for `pt`, `de`, `es`, `it`, `fr`, `nl`, `ru`, `ar` (single-paragraph and multi-document corpora). The remaining drift is bit-level float-precision in the scoring math at exact-tie positions — see `docs/algorithm-drift.md` for the documented residuals.
- Bobbin adapter validation now covers the Bobbin YAKE, topic-extractor, topic-system, and extraction-quality tests in the reference Bobbin checkout, but that validation still needs to be kept current as Bobbin evolves.

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
