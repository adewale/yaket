# Using Yaket In Bobbin

This guide shows how Bobbin can adopt Yaket without rewriting its topic system.

## Goal

Replace Bobbin's current YAKE-like keyword extractor with Yaket while preserving Bobbin's higher-level topic logic.

Keep these layers separate:

1. Yaket extracts ranked keywords.
2. Bobbin continues to own:
   - entity detection
   - noise filtering
   - topic normalization
   - topic merge rules

## Compatibility API

Yaket exports a Bobbin-compatible wrapper:

```ts
import { extractYakeKeywords } from "@ade_oshineye/yaket";

const keywords = extractYakeKeywords(text, 5, 3);
```

This wrapper preserves the current Bobbin-style shape:

```ts
type BobbinYakeResult = {
  keyword: string;
  score: number;
};
```

Notes:

1. `n` maps to result count.
2. `maxNgram` maps to maximum keyword length.
3. returned keywords are lowercased to match Bobbin's current expectations.

## Migrating to Yaket 0.6

If Bobbin is already on Yaket 0.5.x, the 0.6 release removes the snake_case
option aliases and the `extract_keywords()` method. Follow
`docs/migration-bobbin-0.6.md` for the full recipe — it is a one-pass
rename, with no behavior change on the canonical API.

If Bobbin only consumes Yaket through `extractYakeKeywords()`, the upgrade
is a version bump with no code changes.

## Migration path

Recommended adoption sequence:

1. Replace Bobbin's current `extractYakeKeywords()` implementation with Yaket's wrapper behind the same interface.
2. Run Bobbin's existing tests around:
   - `topic-extractor`
   - `topic-system`
   - `topic-quality`
   - taxonomy and noise filtering
3. Add regression tests for any topic-quality regressions discovered in newsletter-style text.
4. Only after the wrapper is stable, consider using richer Yaket APIs directly.

Yaket has now been run through Bobbin's YAKE, topic-extractor, topic-system, and extraction-quality tests in the Bobbin reference checkout via the Bobbin adapter path.

Remaining follow-up: keep that validation current as Bobbin evolves.

## Example integration

Bobbin's `extractTopics()` flow can stay structurally the same:

```ts
import { extractYakeKeywords } from "@ade_oshineye/yaket";

const yakeResults = extractYakeKeywords(cleanText, maxTopics * 2, 3);

for (const kw of yakeResults) {
  const normalized = normalizeTerm(kw.keyword);
  const slug = slugify(normalized);
  if (!slug || usedSlugs.has(slug) || isNoiseTopic(normalized)) {
    continue;
  }

  usedSlugs.add(slug);
  result.push({ name: normalized, slug, score: kw.score });
}
```

## What should not move into Yaket

Do not move these Bobbin-specific rules into Yaket core:

1. newsletter-specific noise words
2. topic taxonomy decisions
3. heuristic entity promotion
4. merge rules across entity and keyword layers

Those belong in Bobbin, not in the extraction library.
