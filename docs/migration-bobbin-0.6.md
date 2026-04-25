# Migrating Bobbin (and other 0.5.x consumers) to Yaket 0.6

Yaket 0.6 drops the snake_case option aliases, the `extract_keywords()`
method, and the dedup-function value aliases that existed for Python YAKE
familiarity and Bobbin compatibility. The extraction behavior is unchanged
on the canonical surface — only the option names, one method name, and
three dedup-function values went away.

If you adopted Yaket 0.5.x by passing canonical names already
(`language`, `dedupLim`, `dedupFunc`, `windowSize`, `extractKeywords()`),
the upgrade is a simple version bump. If you copied Python YAKE's
`yake.KeywordExtractor(lan=..., dedup_lim=..., dedup_func=..., windowsSize=...)`
shape over the wire, follow the recipe below.

## TL;DR rename table

| 0.5.x (removed) | 0.6 (use this) |
|---|---|
| `lan` | `language` |
| `dedup_lim` | `dedupLim` |
| `dedup_func` | `dedupFunc` |
| `windowsSize` | `windowSize` |
| `window_size` | `windowSize` |
| `extractor.extract_keywords(text)` | `extractor.extractKeywords(text)` |
| `extractor.config.lan` | `extractor.config.language` |
| `dedupFunc: "leve"` | `dedupFunc: "levs"` |
| `dedupFunc: "jaro_winkler"` | `dedupFunc: "jaro"` |
| `dedupFunc: "sequencematcher"` | `dedupFunc: "seqm"` |
| `--dedup-func leve\|jaro_winkler\|sequencematcher` | `--dedup-func levs\|jaro\|seqm` |
| `DataCore({ windowsSize })` | `DataCore({ windowSize })` |

Everything else — `n`, `top`, `features`, `stopwords`, the strategy hooks,
`extractFromDocument`, `extractYakeKeywords`, `TextHighlighter`, the
similarity helpers, `STOPWORDS`, `supportedLanguages` — is unchanged.

## What still works without any changes

The Bobbin compatibility wrapper is unchanged:

```ts
import { extractYakeKeywords } from "@ade_oshineye/yaket";

const keywords = extractYakeKeywords(text, 5, 3);
```

`extractYakeKeywords(text, n?, maxNgram?)` keeps the same signature and
result shape (`{ keyword, score }`). Bobbin's `topic-extractor.ts` and
related files do not need to change if they only call this wrapper.

## Recipe: migrating Bobbin's current call sites

### 1. Search for the dropped names

Run these greps in the Bobbin checkout:

```bash
rg -n '\blan:\s*"' src/                # option-key uses
rg -n '\bdedup_(lim|func)\s*[:=]' src/ # snake_case dedup options
rg -n '\bwindow(s|_)Size\b' src/       # both windowsSize variants
rg -n 'extract_keywords\b' src/        # method alias
rg -n '"jaro_winkler"|"sequencematcher"|"leve"' src/  # dedup-value aliases
rg -n 'config\.lan\b' src/             # post-construction reads
```

If a hit is in `src/services/yake.ts` or anywhere the call already routes
through `extractYakeKeywords()`, you do not need to touch it — that wrapper
swallows the change. Everywhere else, apply the rename table.

### 2. Replace one call at a time

Before:

```ts
import { KeywordExtractor } from "@ade_oshineye/yaket";

const extractor = new KeywordExtractor({
  lan: "en",
  n: 3,
  top: 20,
  dedup_lim: 0.9,
  dedup_func: "seqm",
  windowsSize: 1,
});

const keywords = extractor.extract_keywords(text);
const language = extractor.config.lan;
```

After:

```ts
import { KeywordExtractor } from "@ade_oshineye/yaket";

const extractor = new KeywordExtractor({
  language: "en",
  n: 3,
  top: 20,
  dedupLim: 0.9,
  dedupFunc: "seqm",
  windowSize: 1,
});

const keywords = extractor.extractKeywords(text);
const language = extractor.config.language;
```

### 3. Update CLI invocations

If anything shells out to the `yaket` CLI with `--dedup-func leve`,
`--dedup-func jaro_winkler`, or `--dedup-func sequencematcher`, switch to
`levs`, `jaro`, or `seqm` respectively. Other CLI flags (`--language`,
`--ngram-size`, `--dedup-lim`, `--window-size`, `--top`, `--text-input`,
`--input-file`, `--verbose`, `--help`) are unchanged.

### 4. Validate before you ship

After renaming, run Bobbin's existing test layers in this order:

1. Bobbin's YAKE-wrapper tests (`extractYakeKeywords` parity).
2. Bobbin's `topic-extractor` and `topic-system` tests.
3. Bobbin's `extraction-quality` tests on representative newsletter text.

If any of those regress, the regression is almost certainly tokenizer or
stopword behavior (which is unchanged in 0.6) rather than the alias removal,
so check `docs/algorithm-drift.md` first.

## TypeScript-only safety net

Because Yaket 0.6 keeps `KeywordExtractorOptions` exported as an alias for
`YakeOptions` (now identical), the type imports continue to compile.
The dropped fields fail at compile time with a normal "object literal may
only specify known properties" error, which is the easiest way to find the
remaining call sites:

```text
error TS2353: Object literal may only specify known properties, and 'lan' does not exist in type 'YakeOptions'.
```

So in practice the migration is: bump Yaket to `^0.6.0`, run `tsc -p .`,
and rename whatever the type checker flags. Ship once the typecheck and
your existing test suite are clean.

## Why now

The aliases existed because Bobbin (and Python-YAKE migrators) were the
first adopters and we wanted a zero-friction landing. With Bobbin's call
sites narrowing to the `extractYakeKeywords` wrapper and the canonical
camelCase names, the alias surface had become pure cost: extra
`KeywordExtractorOptions` fields, extra constructor branches, an extra
method on the public class, and three extra `dedupFunc` strings that all
collapsed onto the canonical names anyway. Removing them reduces the
public API surface, removes a class of silent-fallthrough bugs (typos
landing on the default branch), and makes the option type readable in one
glance.

The `extractYakeKeywords()` adapter remains the recommended Bobbin
integration point and is still validated against Bobbin's topic tests.
