# Lemmatization Evaluation

This note records the evaluation of whether to ship a fuller optional
lemmatization implementation in Yaket, mirroring upstream Python YAKE's
`lemmatize=True` / `lemmatizer="spacy"|"nltk"` / `lemma_aggregation` surface.

## What upstream offers

Upstream YAKE 0.7.x exposes:

- `lemmatize: bool` (default `False`).
- `lemmatizer: "spacy" | "nltk"` — picks a backend.
- `lemma_aggregation: "min" | "mean" | "max" | "harmonic"` — combines scores
  for keywords that share a lemma.

When enabled, it reduces inflected variants ("trees", "tree") to one entry and
aggregates their scores using the chosen policy. The backends require either
spaCy (with downloaded language models) or NLTK (with WordNet data).

## What Yaket offers today

- `Lemmatizer` is a pure typed hook: `lemmatize(token, context) => string`.
- `CandidateNormalizer` covers casing/punctuation/plural normalization.
- The constructor explicitly rejects string lemmatizer values
  (`KeywordExtractor.ts:79-81`) so the extraction core stays free of process,
  filesystem, and native dependencies.
- The hook runs inside `DataCore.normalizeTerm()` so any user-provided
  lemmatizer transparently merges variants — exactly what `lemmatize=True`
  achieves upstream when the score-aggregation step lines up.

## Decision

A fuller bundled implementation is **not** justified today.

### Why

1. **Edge-safety is a hard requirement.** spaCy/NLTK cannot be bundled. The
   only viable bundled options are pure-JS dictionaries (e.g.
   `wink-lemmatizer`, `lemmatizer`, Snowball ports). They add real bundle
   weight (50–500 KB per language) without matching spaCy's quality.
2. **No standing adopter need.** The TODO list captures multilingual parity
   gaps as the priority. None of the open Bobbin / `flux-search` /
   document-pipeline tracks blocks on bundled lemmatization.
3. **Hook coverage is already complete.** A consumer that wants spaCy/NLTK
   can implement a `Lemmatizer` adapter in the host application — the same
   trade-off Yaket already documents in the README. They are not blocked.
4. **Score-aggregation parity is small in scope.** When a consumer does
   provide a lemmatizer, current Yaket merges variants by sharing the same
   normalized term in `DataCore.terms` / `DataCore.candidates`, which is
   functionally equivalent to upstream's `lemma_aggregation="min"` (the
   collapsed term keeps the best scoring opportunity). The other
   `mean/max/harmonic` policies are minor knobs, not primary behavior.

### What we will do instead

1. Keep documenting the `Lemmatizer` hook as the supported integration path.
2. Track a small follow-up: if a real consumer asks for `mean`/`max`/`harmonic`
   aggregation, expose a `lemmaAggregation` option that operates on the
   already-aggregated normalized-term set without needing dictionary data.
3. Keep upstream's string-backend rejection in place, since accepting
   `"spacy"` / `"nltk"` would silently couple the core to Node-only or
   native dependencies.

### What would change this decision

A concrete adopter requiring:

- multilingual lemma collapsing inside a Cloudflare Worker, or
- byte-for-byte upstream parity on `lemmatize=True` outputs, or
- ranked outputs that depend on `mean`/`harmonic` aggregation.

If any of those land, the proportional next step is to ship the
aggregation policy (no dictionary) and publish optional adapter packages
for spaCy/NLTK/Snowball rather than bundling them into the core.
