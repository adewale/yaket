# Main Use Cases

Yaket is best used as a lightweight keyword extraction stage inside larger systems.

## Strong Fits

### Automatic tagging

Use Yaket to generate lightweight tags for:

- blogs
- CMS content
- knowledge bases
- note-taking tools

### Newsletter and article topic extraction

This is the closest fit to the original Bobbin-style use case.

### Search indexing

Use Yaket to enrich documents with weighted keywords for:

- BM25 fields
- hybrid BM25/vector retrieval
- faceting or boosting signals

### RAG preprocessing

Use Yaket to add lightweight metadata to chunks without paying for an LLM call.

### Content clustering and moderation features

Yaket works well as a cheap feature generator for downstream grouping or review workflows.

### Browser extensions and client-side tools

Because the extraction core is lightweight and edge-compatible, Yaket is a good fit for client-side page analysis.

### Chat and Slack bots

Use Yaket for lightweight topic tagging of messages, transcripts, or channel summaries.

### Academic and research tooling

Yaket is useful when a JavaScript environment needs a YAKE-style baseline without depending on Python at runtime.

## Less Ideal Fits

Yaket is not a replacement for:

1. corpus-level topic modeling
2. semantic embeddings
3. a full moderation or ranking system
4. production-grade multilingual lemmatization

## Recommended Integration Pattern

Treat Yaket as one stage in an enrichment pipeline:

1. clean or chunk the source document
2. run Yaket
3. keep the extracted keywords as metadata
4. apply downstream business logic separately
