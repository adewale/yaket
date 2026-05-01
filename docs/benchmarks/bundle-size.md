# Bundle Size

Esbuild-bundled, worker-target ESM output for the public entry point.
Verified to contain no Node built-ins from the shared forbidden list (`scripts/bundle-leak-detector.ts`).

| Entry | Minified | Bytes | Gzipped |
|---|---|---:|---:|
| `src/index.ts` | yes | 153.4 KiB | 44.3 KiB |
| `src/index.ts` | no | 191.9 KiB | 49.2 KiB |

These numbers include the 34-language bundled stopword set. The bundled stopword text is the dominant contributor; if a consumer needs a smaller edge payload they can ship a single-language `StopwordProvider` and tree-shake the rest.
