# Using Yaket In Ingestion Pipelines

Yaket should be usable in systems that do not have Bobbin's topic layer.

Examples:

1. indexing pipelines
2. search enrichment jobs
3. transcript processing
4. content summarization preprocessors
5. future consumers such as `flux-search`

## Basic pattern

Treat Yaket as a document-to-keywords transform.

```ts
import { extractKeywords } from "yaket";

const keywords = extractKeywords(document.body, {
  lan: document.language ?? "en",
  n: 3,
  top: 10,
});
```

## Document-oriented wrapper

In a pipeline, it is usually better to wrap Yaket in a small adapter that preserves your own document model.

```ts
import { extractKeywords } from "yaket";

type InputDocument = {
  id: string;
  language?: string;
  title?: string;
  body: string;
};

function extractDocumentKeywords(document: InputDocument) {
  return {
    id: document.id,
    keywords: extractKeywords(document.body, {
      lan: document.language ?? "en",
      n: 3,
      top: 10,
    }),
  };
}
```

## Guidance for future consumers like flux-search

To keep Yaket reusable:

1. depend on the core extractor, not Bobbin-specific adapters
2. keep your own result schema outside Yaket
3. add normalization and ranking post-processing in your own pipeline layer
4. treat Yaket as one stage in enrichment, not as a complete topic system

### Example: search enrichment pipeline

```ts
import { extractFromDocument } from "yaket";

const enriched = extractFromDocument({
  id: chunk.id,
  language: chunk.language,
  title: chunk.title,
  body: chunk.body,
  metadata: { source: "search-index" },
}, {
  top: 8,
  n: 3,
});

const searchRecord = {
  id: enriched.id,
  title: enriched.title,
  body: chunk.body,
  keywords: enriched.keywords.map((item) => item.normalizedKeyword),
};
```

## Cloudflare Worker guidance

If you are using Yaket in an edge runtime:

1. import the extraction API directly
2. avoid adding adapters that depend on Node-only APIs
3. keep assets bundled at build time
4. run `npm run test:cloudflare` as part of CI
